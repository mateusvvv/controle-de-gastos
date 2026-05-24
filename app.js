let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let budget = parseFloat(localStorage.getItem('budget')) || 0;
let savingsGoal = parseFloat(localStorage.getItem('savingsGoal')) || 0;
let walletValue = parseFloat(localStorage.getItem('walletValue')) || 0;
let expenseChart = null;
let editingId = null;

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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    budgetInput.value = budget > 0 ? formatCurrency(budget) : "";
    savingsGoalInput.value = savingsGoal > 0 ? formatCurrency(savingsGoal) : "";
    walletInput.value = walletValue > 0 ? formatCurrency(walletValue) : "";

    // Define o mês atual como padrão no filtro
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    document.getElementById('month-filter').value = currentMonth;
    
    checkRecurringAndInstallments();
    updateUI();
});

// Controle do Painel de Resumo
document.getElementById('toggle-summary-btn').addEventListener('click', function() {
    const summaryGrid = document.getElementById('summary-grid');
    summaryGrid.classList.toggle('hidden-summary');
    this.innerText = summaryGrid.classList.contains('hidden-summary') ? '📊 Ver Resumo Financeiro' : '🔼 Ocultar Resumo';
});

budgetInput.addEventListener('input', applyMask);
budgetInput.addEventListener('change', (e) => {
    budget = parseCurrency(e.target.value);
    localStorage.setItem('budget', budget);
    updateUI();
});

savingsGoalInput.addEventListener('input', applyMask);
savingsGoalInput.addEventListener('change', (e) => {
    savingsGoal = parseCurrency(e.target.value);
    localStorage.setItem('savingsGoal', savingsGoal);
    updateUI();
});

walletInput.addEventListener('input', applyMask);
walletInput.addEventListener('change', (e) => {
    walletValue = parseCurrency(e.target.value);
    localStorage.setItem('walletValue', walletValue);
    updateUI();
});

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
        for (let i = 0; i < installments; i++) {
            const futureDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 15);
            const newExpense = {
                id: Date.now() + i,
                description: `${description} (${i + 1}/${installments})`,
                amount: amount,
                category: category,
                isFixed: false, // Parcelas não são "infinitas", são temporárias
                date: futureDate.toLocaleDateString('pt-BR'),
                receipt: receiptData
            };
            expenses.push(newExpense);
        }
        saveAndRefresh();
        expenseForm.reset();
        return;
    }

    if (editingId) {
        const index = expenses.findIndex(exp => exp.id === editingId);
        if (index !== -1) {
            expenses[index] = {
                ...expenses[index],
                description: description,
                amount: amount,
                category: category,
                receipt: receiptData || expenses[index].receipt,
                isFixed: isFixed
            };
        }
        editingId = null;
        expenseForm.querySelector('button[type="submit"]').innerText = 'Adicionar';
    } else {
        const newExpense = {
            id: Date.now(),
            description: document.getElementById('desc').value,
            amount: parseCurrency(document.getElementById('amount').value),
            category: document.getElementById('category').value,
            isFixed: document.getElementById('is-fixed').checked,
            date: new Date().toLocaleDateString(),
            receipt: receiptData
        };
        expenses.push(newExpense);
    }

    saveAndRefresh();
    expenseForm.reset();
});

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

function saveAndRefresh() {
    localStorage.setItem('expenses', JSON.stringify(expenses));
    updateUI();
}

function checkRecurringAndInstallments() {
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Pega o mês anterior para clonar gastos fixos
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lastMonthDate.getFullYear()}-${(lastMonthDate.getMonth() + 1).toString().padStart(2, '0')}`;

    const currentExpenses = expenses.filter(exp => {
        const [d, m, y] = exp.date.split('/');
        return `${y}-${m.padStart(2, '0')}` === currentMonthStr;
    });

    const fixedFromLastMonth = expenses.filter(exp => {
        const [d, m, y] = exp.date.split('/');
        return exp.isFixed && `${y}-${m.padStart(2, '0')}` === lastMonthStr;
    });

    fixedFromLastMonth.forEach(oldExp => {
        const alreadyCloned = currentExpenses.some(curr => curr.description === oldExp.description && curr.isFixed);
        if (!alreadyCloned) {
            expenses.push({
                ...oldExp,
                id: Date.now() + Math.random(),
                date: now.toLocaleDateString('pt-BR')
            });
        }
    });
    localStorage.setItem('expenses', JSON.stringify(expenses));
}

function deleteExpense(id) {
    if (editingId === id) {
        editingId = null;
        expenseForm.reset();
        expenseForm.querySelector('button[type="submit"]').innerText = 'Adicionar';
    }
    expenses = expenses.filter(exp => exp.id !== id);
    saveAndRefresh();
}

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
        // Converte DD/MM/YYYY para YYYY-MM para comparar
        const [day, month, year] = exp.date.split('/');
        const expMonth = `${year}-${month.padStart(2, '0')}`;
        return expMonth === selectedMonth;
    });
}

function updateChart(filteredData) {
    const ctx = document.getElementById('expenseChart').getContext('2d');
    
    // Agrupar totais por categoria
    const categories = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Outros'];
    const totals = categories.map(cat => {
        return filteredData
            .filter(exp => exp.category === cat)
            .reduce((sum, exp) => sum + exp.amount, 0);
    });

    // Destruir gráfico anterior para evitar sobreposição ao atualizar
    if (expenseChart) {
        expenseChart.destroy();
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
            scales: {
                y: { beginAtZero: true }
            },
            plugins: {
                legend: { display: false }
            }
        }
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
                <button onclick="editExpense(${exp.id})" class="btn-primary" style="padding: 5px 10px; margin-right: 5px;">Editar</button>
                <button onclick="deleteExpense(${exp.id})" class="btn-danger">X</button>
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
    reserveEl.style.color = finalReserve >= 0 ? '#2c3e50' : 'var(--danger)';

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