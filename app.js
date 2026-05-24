import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let expenses = [];
let budget = 0;
let savingsGoal = 0;
let walletValue = 0;
let expenseChart = null;
let editingId = null;
let currentUser = null;

const expenseForm = document.getElementById('expense-form');
const budgetInput = document.getElementById('monthly-budget');
const savingsGoalInput = document.getElementById('savings-goal');
const walletInput = document.getElementById('wallet-value');
const expensesList = document.getElementById('expenses-list');
const amountInput = document.getElementById('amount');

// Auxiliares de Formatação
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    return parseFloat(value.replace(/\D/g, "")) / 100 || 0;
};

const applyMask = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    value = (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    e.target.value = value ? "R$ " + value : "";
};

const getExpenseYearMonth = (dateStr) => {
    if (!dateStr) return null;

    if (typeof dateStr.toDate === 'function') {
        const date = dateStr.toDate();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (dateStr instanceof Date) {
        return `${dateStr.getFullYear()}-${String(dateStr.getMonth() + 1).padStart(2, '0')}`;
    }

    const parts = String(dateStr).split(/[-/]/);

    if (parts.length < 3) return null;
    if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }

    const first = Number(parts[0]);
    const second = Number(parts[1]);
    const month = second > 12 ? first : second;
    return `${parts[2]}-${String(month).padStart(2, '0')}`;
};

const getExpenseMonth = (expense) => {
    return getExpenseYearMonth(expense.date) || getExpenseYearMonth(expense.createdAt);
};

// Observador de Autenticação e Carregamento de Dados
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        
        // Carregar Configurações (Salário, Meta, Carteira)
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            budget = data.budget || 0;
            savingsGoal = data.savingsGoal || 0;
            walletValue = data.walletValue || 0;
            
            budgetInput.value = budget > 0 ? formatCurrency(budget) : "";
            savingsGoalInput.value = savingsGoal > 0 ? formatCurrency(savingsGoal) : "";
            walletInput.value = walletValue > 0 ? formatCurrency(walletValue) : "";
        }

        // Define o mês atual como padrão no filtro
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        document.getElementById('month-filter').value = currentMonth;

        // Carregar Coleção de Gastos
        const q = query(collection(db, "users", user.uid, "expenses"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        expenses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await checkRecurringAndInstallments();
        updateUI();
    }
});

// Controle do Painel de Resumo
document.getElementById('toggle-summary-btn').addEventListener('click', function() {
    const summaryGrid = document.getElementById('summary-grid');
    summaryGrid.classList.toggle('hidden-summary');
    this.innerText = summaryGrid.classList.contains('hidden-summary') ? '📊 Ver Resumo Financeiro' : '🔼 Ocultar Resumo';
});

async function updateUserSettings() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), {
        budget, savingsGoal, walletValue
    }, { merge: true });
}

budgetInput.addEventListener('input', (e) => {
    applyMask(e);
    budget = parseCurrency(e.target.value);
    updateUI();
});
budgetInput.addEventListener('change', updateUserSettings);

savingsGoalInput.addEventListener('input', (e) => {
    applyMask(e);
    savingsGoal = parseCurrency(e.target.value);
    updateUI();
});
savingsGoalInput.addEventListener('change', updateUserSettings);

walletInput.addEventListener('input', (e) => {
    applyMask(e);
    walletValue = parseCurrency(e.target.value);
    updateUI();
});
walletInput.addEventListener('change', updateUserSettings);

amountInput.addEventListener('input', applyMask);

document.getElementById('month-filter').addEventListener('change', updateUI);

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('receipt');
    let receiptData = null;

    if (fileInput.files.length > 0) {
        receiptData = await toBase64(fileInput.files[0]);
    }

    const installments = parseInt(document.getElementById('installments').value) || 1;
    const description = document.getElementById('desc').value;
    const amount = parseCurrency(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const isFixed = document.getElementById('is-fixed').checked;

    if (!editingId && installments > 1) {
        // Lógica de Parcelamento
        const startDate = new Date();
        const installmentAmount = amount / installments;
        for (let i = 0; i < installments; i++) {
            const futureDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 15);
            const newExpenseData = {
                description: `${description} (${i + 1}/${installments})`,
                amount: installmentAmount,
                category: category,
                isFixed: false,
                date: futureDate.toLocaleDateString('pt-BR'),
                receipt: receiptData,
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newExpenseData);
            expenses.push({ id: docRef.id, ...newExpenseData });
        }
        updateUI();
        expenseForm.reset();
        return;
    }

    if (editingId) {
        const updatedData = {
            description: description,
            amount: amount,
            category: category,
            receipt: receiptData || expenses.find(e => e.id === editingId).receipt,
            isFixed: isFixed
        };
        await updateDoc(doc(db, "users", currentUser.uid, "expenses", editingId), updatedData);
        const index = expenses.findIndex(exp => exp.id === editingId);
        if (index !== -1) expenses[index] = { ...expenses[index], ...updatedData };
        
        editingId = null;
        expenseForm.querySelector('button[type="submit"]').innerText = 'Adicionar';
    } else {
        const newExpenseData = {
            description: document.getElementById('desc').value,
            amount: parseCurrency(document.getElementById('amount').value),
            category: document.getElementById('category').value,
            isFixed: document.getElementById('is-fixed').checked,
            date: new Date().toLocaleDateString('pt-BR'),
            receipt: receiptData,
            createdAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newExpenseData);
        expenses.push({ id: docRef.id, ...newExpenseData });
    }

    updateUI();
    expenseForm.reset();
});

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function checkRecurringAndInstallments() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Pega o mês anterior para clonar gastos fixos
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${(lastMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const currentExpenses = expenses.filter(exp => {
        return getExpenseYearMonth(exp.date) === currentMonthStr;
    });

    const fixedFromLastMonth = expenses.filter(exp => {
        return exp.isFixed && getExpenseYearMonth(exp.date) === lastMonthStr;
    });

    for (const oldExp of fixedFromLastMonth) {
        const alreadyCloned = currentExpenses.some(curr => curr.description === oldExp.description && curr.isFixed);
        if (!alreadyCloned) {
            const newFixedExpense = {
                ...oldExp,
                date: now.toLocaleDateString('pt-BR'),
                createdAt: serverTimestamp()
            };
            delete newFixedExpense.id; 
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newFixedExpense);
            expenses.push({ id: docRef.id, ...newFixedExpense });
        }
    }
}

async function deleteExpense(id) {
    if (editingId === id) {
        editingId = null;
        expenseForm.reset();
        expenseForm.querySelector('button[type="submit"]').innerText = 'Adicionar';
    }
    
    if (currentUser) {
        await deleteDoc(doc(db, "users", currentUser.uid, "expenses", id));
        expenses = expenses.filter(exp => exp.id !== id);
        updateUI();
    }
}

// Expor funções para o escopo global (necessário pois o script é um módulo)
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.updateUI = updateUI;
updateChart([]);

function editExpense(id) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById('desc').value = exp.description;
    document.getElementById('amount').value = formatCurrency(exp.amount);
    document.getElementById('category').value = exp.category;
    document.getElementById('is-fixed').checked = exp.isFixed || false;

    editingId = id;
    expenseForm.querySelector('button[type="submit"]').innerText = 'Atualizar Gasto';
    expenseForm.scrollIntoView({ behavior: 'smooth' });
}

function getFilteredExpenses() {
    const selectedMonth = document.getElementById('month-filter').value; // Formato YYYY-MM
    if (!selectedMonth) return expenses;

    return expenses.filter(exp => {
        return getExpenseMonth(exp) === selectedMonth;
    });
}

function updateChart(filteredData) {
    const canvas = document.getElementById('expenseChart');
    const emptyMessage = document.getElementById('chart-empty-message');
    if (!canvas) return;

    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Agrupar totais por categoria
    const categories = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Outros'];
    const data = filteredData || [];
    const totals = categories.map(cat => {
        return data
            .filter(exp => exp.category === cat)
            .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    });

    const hasData = totals.some(t => t > 0);
    emptyMessage?.classList.toggle('hidden', hasData);

    if (typeof Chart === 'undefined') {
        drawFallbackChart(canvas, categories, totals, hasData);
        return;
    }

    expenseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Total Gasto (R$)',
                data: totals,
                backgroundColor: [
                    '#4a90e2', // Moradia
                    '#2ecc71', // Alimentação
                    '#e67e22', // Transporte
                    '#9b59b6', // Lazer
                    '#95a5a6'  // Outros
                ],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true,
                    suggestedMax: hasData ? undefined : 100,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function drawFallbackChart(canvas, labels, totals, hasData) {
    const ctx = canvas.getContext('2d');
    const width = canvas.clientWidth || 900;
    const height = canvas.clientHeight || 300;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const maxValue = Math.max(...totals, 100);
    const chartLeft = 48;
    const chartRight = width - 16;
    const chartBottom = height - 42;
    const chartTop = 18;
    const barArea = chartRight - chartLeft;
    const barWidth = Math.max((barArea / labels.length) * 0.58, 22);
    const colors = ['#4a90e2', '#2ecc71', '#e67e22', '#9b59b6', '#95a5a6'];

    ctx.strokeStyle = '#e5e9ef';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartLeft, chartTop);
    ctx.lineTo(chartLeft, chartBottom);
    ctx.lineTo(chartRight, chartBottom);
    ctx.stroke();

    if (!hasData) return;

    labels.forEach((label, index) => {
        const slot = barArea / labels.length;
        const x = chartLeft + slot * index + (slot - barWidth) / 2;
        const barHeight = ((chartBottom - chartTop) * totals[index]) / maxValue;
        const y = chartBottom - barHeight;

        ctx.fillStyle = colors[index];
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.fillStyle = '#5f6f7a';
        ctx.font = '12px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x + barWidth / 2, height - 16);
    });
}

function updateUI() {
    expensesList.innerHTML = '';
    const filtered = getFilteredExpenses();
    let totalSpent = 0;
    let fixedTotal = 0;
    let variableTotal = 0;

    filtered.forEach(exp => {
        totalSpent += exp.amount;
        if (exp.isFixed) fixedTotal += exp.amount;
        else variableTotal += exp.amount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${exp.description}</td>
            <td>${exp.category}</td>
            <td>${exp.isFixed ? '<span class="badge-fixed">Fixa</span>' : '<span class="badge-once">1x</span>'}</td>
            <td>${formatCurrency(exp.amount || 0)}</td>
            <td>${exp.receipt ? `<a href="${exp.receipt}" target="_blank">Ver</a>` : '-'}</td>
            <td>
                <button onclick="editExpense('${exp.id}')" class="btn-primary" style="padding: 5px 10px; margin-right: 5px;">Editar</button>
                <button onclick="deleteExpense('${exp.id}')" class="btn-danger">X</button>
            </td>
        `;
        expensesList.appendChild(tr);
    });

    document.getElementById('total-spent').innerText = formatCurrency(totalSpent);
    document.getElementById('fixed-total').innerText = formatCurrency(fixedTotal);
    document.getElementById('variable-total').innerText = formatCurrency(variableTotal);
    
    // Saldo disponível após gastos
    const availableAfterExpenses = budget - totalSpent;
    
    // Saldo que sobra depois que você tira o dinheiro da carteira e da meta
    const finalReserve = availableAfterExpenses - walletValue - savingsGoal;
    const reserveEl = document.getElementById('final-reserve');
    reserveEl.innerText = formatCurrency(finalReserve);
    reserveEl.style.color = finalReserve >= 0 ? '#1f7a55' : 'var(--danger)';

    // Lógica da Meta de Economia
    const goalStatus = document.getElementById('goal-status');
    const goalBar = document.getElementById('goal-bar');
    
    if (savingsGoal > 0) {
        const goalPercent = Math.min(Math.max((availableAfterExpenses / savingsGoal) * 100, 0), 100);
        goalBar.style.width = goalPercent + '%';
        goalBar.style.backgroundColor = goalPercent >= 100 ? 'var(--success)' : 'var(--primary)';
        goalStatus.innerText = goalPercent >= 100 ? "Meta alcançada!" : `${goalPercent.toFixed(0)}% da meta`;
    } else {
        goalBar.style.width = '0%';
        goalStatus.innerText = "Sem meta definida";
    }

    // Atualiza Barra de Progresso
    const percent = budget > 0 ? Math.min((totalSpent / budget) * 100, 100) : 0;
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = percent + '%';
    progressBar.style.backgroundColor = percent > 90 ? 'var(--danger)' : (percent > 70 ? '#e67e22' : 'var(--success)');
    document.getElementById('progress-text').innerText = `${percent.toFixed(1)}% do salário utilizado`;

    updateChart(filtered);
}

// Geração de PDF usando jsPDF
document.getElementById('generate-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const filtered = getFilteredExpenses();
    const selectedMonth = document.getElementById('month-filter').value;

    doc.text(`Relatório de Gastos - ${selectedMonth}`, 14, 15);
    doc.text(`Orçamento: R$ ${budget.toFixed(2)}`, 14, 25);
    
    const tableData = filtered.map(exp => [
        exp.date,
        exp.description,
        exp.category,
        formatCurrency(exp.amount)
    ]);

    doc.autoTable({
        head: [['Data', 'Descrição', 'Categoria', 'Valor']],
        body: tableData,
        startY: 30
    });

    const total = filtered.reduce((sum, exp) => sum + exp.amount, 0);
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total Gasto: R$ ${total.toFixed(2)}`, 14, finalY);
    doc.text(`Saldo Restante: R$ ${(budget - total).toFixed(2)}`, 14, finalY + 10);

    doc.save('meus-gastos.pdf');
});
