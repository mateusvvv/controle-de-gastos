import { db, auth } from './firebase-config.js';
import { 
    collection, addDoc, getDocs, doc, setDoc, deleteDoc, updateDoc, getDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let expenses = [];
let budget = 0;
let extraIncome = 0;
let savingsGoal = 0;
let walletValue = 0;
let salaryDate = "";
let extraIncomeDate = "";
let expenseChart = null;
let editingId = null;
let currentUser = null;
let updateTimeout = null;
let expandedGroups = new Set(); // Rastreia quais grupos de parcelas estão visíveis

const expenseForm = document.getElementById('expense-form');
const budgetInput = document.getElementById('monthly-budget');
const extraIncomeInput = document.getElementById('extra-income');
const salaryDateInput = document.getElementById('salary-date');
const extraIncomeDateInput = document.getElementById('extra-income-date');
const savingsGoalInput = document.getElementById('savings-goal');
const walletInput = document.getElementById('wallet-value');
const expensesList = document.getElementById('expenses-list');
const amountInput = document.getElementById('amount');
const receiptInput = document.getElementById('receipt');
const fileNameDisplay = document.getElementById('file-name-display');
const categorySelect = document.getElementById('category');
const otherCategoryInput = document.getElementById('other-category');

// Elementos do Modal de Lançamento Rápido
const quickAddModal = document.getElementById('quick-add-modal');
const modalCategorySelect = document.getElementById('modal-category');
const modalOtherCategoryInput = document.getElementById('modal-other-category');
const modalAmountInput = document.getElementById('modal-amount');
const modalDateInput = document.getElementById('modal-date');
// Auxiliares de Formatação
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const parseCurrency = (value) => {
    if (typeof value === 'number') return value;
    return parseFloat(value.replace(/\D/g, "")) || 0;
};

const applyMask = (e) => {
    let value = e.target.value.replace(/\D/g, "");
    value = value ? parseInt(value, 10).toLocaleString('pt-BR') : "";
    e.target.value = value ? "R$ " + value : "";
};

const getExpenseYearMonth = (dateStr) => {
    if (!dateStr) return null;
    const parts = String(dateStr).split(/[-/]/);

    if (parts.length < 3) return null;
    if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }

    return `${parts[2]}-${parts[1].padStart(2, '0')}`;
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
            extraIncome = data.extraIncome || 0;
            savingsGoal = data.savingsGoal || 0;
            walletValue = data.walletValue || 0;
            const now = new Date();
            const today = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
            
            salaryDate = data.salaryDate || today;
            extraIncomeDate = data.extraIncomeDate || today;
            
            budgetInput.value = budget > 0 ? "R$ " + budget.toLocaleString('pt-BR') : "";
            extraIncomeInput.value = extraIncome > 0 ? "R$ " + extraIncome.toLocaleString('pt-BR') : "";
            savingsGoalInput.value = savingsGoal > 0 ? "R$ " + savingsGoal.toLocaleString('pt-BR') : "";
            walletInput.value = walletValue > 0 ? "R$ " + walletValue.toLocaleString('pt-BR') : "";
            
            salaryDateInput.value = salaryDate;
            extraIncomeDateInput.value = extraIncomeDate;
        }

        // Carregar Coleção de Gastos
        // Define o mês atual como padrão no filtro
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        document.getElementById('month-filter').value = currentMonth;

        // Carregar Coleção de Gastos
        const q = query(collection(db, "users", user.uid, "expenses"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        expenses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        await checkRecurringAndInstallments();
        
        // Pequeno atraso para garantir que o DOM e as bibliotecas externas (Chart.js) estejam prontos
        setTimeout(() => {
            updateUI();
        }, 100);
    }
});

// Delegação de Eventos para a Tabela (Resolve os botões que não funcionam)
expensesList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const groupId = btn.getAttribute('data-group');

    if (btn.classList.contains('btn-edit')) {
        editExpense(id);
    } else if (btn.classList.contains('btn-delete')) {
        deleteExpense(id);
    } else if (btn.classList.contains('btn-paid')) {
        togglePaidStatus(id);
    } else if (btn.classList.contains('btn-delete-group')) {
        deleteExpenseGroup(groupId);
    } else if (btn.classList.contains('btn-toggle-group')) {
        toggleInstallments(groupId);
    }
});

// Funções para os botões da tabela (Corrigindo o que não funcionava)
async function togglePaidStatus(id) {
    if (!confirm("Deseja alterar o status de pagamento deste gasto?")) return;
    const exp = expenses.find(e => e.id === id);
    if (!exp || !currentUser) return;
    const newStatus = !exp.isPaid;
    await updateDoc(doc(db, "users", currentUser.uid, "expenses", id), { isPaid: newStatus });
    exp.isPaid = newStatus;
    updateUI();
}

async function deleteExpenseGroup(groupId) {
    if (!confirm("Deseja realmente excluir todas as parcelas deste grupo?")) return;
    if (currentUser) {
        const groupItems = expenses.filter(e => e.groupId === groupId);
        const deletePromises = groupItems.map(item => 
            deleteDoc(doc(db, "users", currentUser.uid, "expenses", item.id))
        );
        await Promise.all(deletePromises);
        expenses = expenses.filter(e => e.groupId !== groupId);
        updateUI();
    }
}

function toggleInstallments(groupId) {
    const rows = document.querySelectorAll(`.installment-row-${groupId}`);
    const btn = document.querySelector(`button[data-group="${groupId}"].btn-toggle-group`);
    
    if (rows.length > 0) {
        const isOpening = rows[0].classList.contains('hidden');
        if (isOpening) {
            expandedGroups.add(groupId);
            if (btn) btn.innerText = 'Ocultar todas as parcelas';
        } else {
            expandedGroups.delete(groupId);
            if (btn) btn.innerText = 'Todas as parcelas';
        }
        rows.forEach(row => row.classList.toggle('hidden'));
    }
}

// Mostrar/Esconder campo de categoria personalizada no modal
modalCategorySelect.addEventListener('change', (e) => {
    if (e.target.value === 'Outros') {
        modalOtherCategoryInput.classList.remove('hidden');
        modalOtherCategoryInput.focus();
    } else {
        modalOtherCategoryInput.classList.add('hidden');
        // Pula automaticamente para o campo de valor após escolher a categoria
        if (e.target.value !== '') modalAmountInput.focus();
    }
});

// Aplicar máscara de moeda no input de valor do modal
modalAmountInput.addEventListener('input', applyMask);


// Lógica para mostrar/esconder campo de dia de vencimento
document.getElementById('is-fixed').addEventListener('change', function() {
    const container = document.getElementById('fixed-day-container');
    if (this.checked) container.classList.remove('hidden');
    else container.classList.add('hidden');
});

// Controle do Painel de Resumo
document.getElementById('toggle-summary-btn').addEventListener('click', function() {
    const summaryGrid = document.getElementById('summary-grid');
    summaryGrid.classList.toggle('hidden-summary');
    this.innerText = summaryGrid.classList.contains('hidden-summary') ? '📊 Resumo Financeiro' : '🔼 Ocultar Resumo';
});

async function updateUserSettings() {
    if (!currentUser) return;
    await setDoc(doc(db, "users", currentUser.uid), {
        budget, extraIncome, savingsGoal, walletValue, salaryDate, extraIncomeDate
    }, { merge: true });
}

budgetInput.addEventListener('input', (e) => {
    applyMask(e);
    budget = parseCurrency(e.target.value);
    updateCalculationsOnly();
});
budgetInput.addEventListener('change', updateUserSettings);

extraIncomeInput.addEventListener('input', (e) => {
    applyMask(e);
    extraIncome = parseCurrency(e.target.value);
    updateCalculationsOnly();
});
extraIncomeInput.addEventListener('change', updateUserSettings);

salaryDateInput.addEventListener('change', (e) => {
    salaryDate = e.target.value;
    updateUserSettings();
});

extraIncomeDateInput.addEventListener('change', (e) => {
    extraIncomeDate = e.target.value;
    updateUserSettings();
});

savingsGoalInput.addEventListener('input', (e) => {
    applyMask(e);
    savingsGoal = parseCurrency(e.target.value);
    updateCalculationsOnly();
});
savingsGoalInput.addEventListener('change', updateUserSettings);

walletInput.addEventListener('input', (e) => {
    applyMask(e);
    walletValue = parseCurrency(e.target.value);
    updateCalculationsOnly();
});
walletInput.addEventListener('change', updateUserSettings);

amountInput.addEventListener('input', applyMask);

document.getElementById('month-filter').addEventListener('change', updateUI);

// Feedback visual para saber se o arquivo foi carregado
receiptInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileNameDisplay.innerText = `📎 ${e.target.files[0].name}`;
        fileNameDisplay.style.color = 'var(--primary)';
    } else {
        fileNameDisplay.innerText = 'Nenhum arquivo selecionado';
        fileNameDisplay.style.color = '#7f8c8d';
    }
});

// Mostrar/Esconder campo de categoria personalizada
categorySelect.addEventListener('change', (e) => {
    if (e.target.value === 'Outros') {
        otherCategoryInput.classList.remove('hidden');
    } else {
        otherCategoryInput.classList.add('hidden');
    }
});

expenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('receipt');
    let receiptData = null;

    if (!currentUser) {
        alert("Sessão expirada. Por favor, faça login novamente.");
        return;
    }

    const submitBtn = expenseForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Salvando...";

    try {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.type.startsWith('image/')) {
                // Comprime imagens para caber no limite de 1MB do Firestore
                receiptData = await compressImage(file);
            } else {
                if (file.size > 750 * 1024) {
                    alert("PDF muito grande. O limite para PDFs no banco de dados é de 750KB. Tente um arquivo menor ou envie uma foto/print.");
                    return;
                }
                receiptData = await toBase64(file);
            }
        }

        const installments = parseInt(document.getElementById('installments').value) || 1;
        const description = document.getElementById('desc').value;
        const amount = parseCurrency(document.getElementById('amount').value);
        const dueDay = parseInt(document.getElementById('due-day').value) || new Date().getDate();
        const groupId = Date.now().toString(); // Identificador para agrupar as parcelas
        
        let category = categorySelect.value;
        if (category === 'Outros' && otherCategoryInput.value.trim() !== '') {
            category = otherCategoryInput.value.trim();
        }

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
                    isPaid: false,
                    groupId: groupId,
                    date: `${dueDay.toString().padStart(2, '0')}/${(futureDate.getMonth() + 1).toString().padStart(2, '0')}/${futureDate.getFullYear()}`,
                receipt: receiptData || null,
                    createdAt: serverTimestamp()
                };
                const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newExpenseData);
                expenses.push({ id: docRef.id, ...newExpenseData });
            }
        
        // Limpeza após salvar parcelas
        expenseForm.reset();
        if (fileNameDisplay) fileNameDisplay.innerText = 'Nenhum arquivo selecionado';
        otherCategoryInput.classList.add('hidden');
        updateUI();
        }

        else if (editingId) {
            const updatedData = {
                description: description,
                amount: amount,
                category: category,
                receipt: receiptData || expenses.find(e => e.id === editingId)?.receipt || null,
                isFixed: isFixed
            };
            await updateDoc(doc(db, "users", currentUser.uid, "expenses", editingId), updatedData);
            const index = expenses.findIndex(exp => exp.id === editingId);
            if (index !== -1) expenses[index] = { ...expenses[index], ...updatedData };
            
            editingId = null;
            expenseForm.querySelector('button[type="submit"]').innerText = 'Adicionar';
        } else {
            const dueDayInput = document.getElementById('due-day').value;
            const now = new Date();
            const dateStr = isFixed && dueDayInput ? 
                `${dueDayInput.toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}` : 
                now.toLocaleDateString('pt-BR');

            const newExpenseData = {
                description: description,
                amount: amount,
                category: category,
                isFixed: isFixed,
                dueDay: isFixed ? dueDay : null,
                isPaid: false,
                date: dateStr,
                receipt: receiptData || null,
                createdAt: serverTimestamp()
            };
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newExpenseData);
            expenses.push({ id: docRef.id, ...newExpenseData });
        }

        // Limpeza parcial: mantém a categoria e data para facilitar múltiplos lançamentos
        document.getElementById('desc').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('other-category').value = '';
        document.getElementById('other-category').classList.add('hidden');
        if (receiptInput) receiptInput.value = '';
        if (fileNameDisplay) fileNameDisplay.innerText = 'Nenhum arquivo selecionado';
        
        document.getElementById('desc').focus();
        updateUI();
    } catch (error) {
        console.error("Erro ao salvar gasto:", error);
        alert("Ocorreu um erro ao salvar: " + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = originalBtnText;
    }
});

const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

const compressImage = (file, maxWidth = 800, quality = 0.6) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Converte para JPEG com qualidade reduzida para economizar espaço
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
    };
    reader.onerror = err => reject(err);
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
                isPaid: false, // Garante que a conta comece como pendente no mês novo
                date: now.toLocaleDateString('pt-BR'),
                createdAt: serverTimestamp()
            };
            delete newFixedExpense.id; 
            const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newFixedExpense);
            expenses.push({ id: docRef.id, ...newFixedExpense });
        }
    }
}

// Função para Lançamento Rápido de Contas Essenciais
document.getElementById('quick-add-essentials')?.addEventListener('click', async () => {
    if (!currentUser) return;

    if (confirm("Deseja abrir o lançador de contas essenciais para inserir valores?")) {
        openQuickAddModal();
    }
});

// Confirmação para limpar o formulário
document.getElementById('clear-form')?.addEventListener('click', (e) => {
    if (!confirm("Tem certeza que deseja limpar todos os campos do formulário?")) {
        e.preventDefault();
    }
});

function openQuickAddModal() {
    quickAddModal.classList.remove('hidden');
    // Resetar campos do modal
    modalCategorySelect.value = '';
    modalOtherCategoryInput.value = '';
    modalOtherCategoryInput.classList.add('hidden');
    modalAmountInput.value = '';
    if (modalDateInput) modalDateInput.value = '';
    modalCategorySelect.focus();
}

function closeQuickAddModal() {
    quickAddModal.classList.add('hidden');
}

document.getElementById('close-quick-add-modal')?.addEventListener('click', closeQuickAddModal);

// Lógica para adicionar despesa do modal
document.getElementById('quick-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
        alert("Sessão expirada. Por favor, faça login novamente.");
        return;
    }

    let category = modalCategorySelect.value;
    if (category === 'Outros' && modalOtherCategoryInput.value.trim() !== '') {
        category = modalOtherCategoryInput.value.trim();
    } else if (category === 'Outros' && modalOtherCategoryInput.value.trim() === '') {
        alert("Por favor, insira o nome da categoria personalizada.");
        return;
    }

    const amount = parseCurrency(modalAmountInput.value);
    const modalDateRaw = modalDateInput.value;
    let dueDay = new Date().getDate();
    let dateStr;

    if (modalDateRaw) {
        const [y, m, d] = modalDateRaw.split('-');
        dateStr = `${d}/${m}/${y}`;
        dueDay = parseInt(d);
    } else {
        dateStr = new Date().toLocaleDateString('pt-BR');
    }

    const description = `Conta de ${category}`; // Descrição padrão para contas essenciais

    const newExpenseData = {
        description: description,
        amount: amount,
        category: category,
        isFixed: true, // Contas essenciais são sempre fixas
        dueDay: dueDay,
        isPaid: false,
        date: dateStr,
        createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(db, "users", currentUser.uid, "expenses"), newExpenseData);
    expenses.push({ id: docRef.id, ...newExpenseData });

    // Limpar campos do modal para adicionar mais
    modalCategorySelect.value = '';
    modalOtherCategoryInput.value = '';
    modalOtherCategoryInput.classList.add('hidden');
    modalAmountInput.value = '';
    modalDateInput.value = '';
    modalCategorySelect.focus(); // Foca na seleção de categoria para o próximo lançamento
    updateUI();
    alert(`Conta de ${category} adicionada com sucesso!`);
});

async function deleteExpense(id) {
    if (!confirm("Deseja realmente excluir este gasto?")) return;
    
    if (editingId === id) {
        editingId = null;
        expenseForm.reset();
        fileNameDisplay.innerText = 'Nenhum arquivo selecionado';
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

function editExpense(id) {
    const exp = expenses.find(e => e.id === id);
    if (!exp) return;

    document.getElementById('desc').value = exp.description;
    document.getElementById('amount').value = "R$ " + Math.floor(exp.amount).toLocaleString('pt-BR');
    
    // Lógica para carregar categoria personalizada na edição
    const optionExists = Array.from(categorySelect.options).some(opt => opt.value === exp.category);
    if (optionExists) {
        categorySelect.value = exp.category;
        otherCategoryInput.classList.add('hidden');
    } else {
        categorySelect.value = 'Outros';
        otherCategoryInput.value = exp.category;
        otherCategoryInput.classList.remove('hidden');
    }

    document.getElementById('is-fixed').checked = exp.isFixed || false;

    editingId = id;
    expenseForm.querySelector('button[type="submit"]').innerText = 'Atualizar Gasto';
    expenseForm.scrollIntoView({ behavior: 'smooth' });
}

function getFilteredExpenses() {
    const selectedMonth = document.getElementById('month-filter').value; // Formato YYYY-MM
    if (!selectedMonth) return expenses;

    return expenses.filter(exp => {
        return getExpenseYearMonth(exp.date) === selectedMonth;
    });
}

function updateChart(filteredData) {
    const canvas = document.getElementById('expenseChart');
    
    // Se a biblioteca Chart.js ainda não carregou, tenta novamente em breve
    if (typeof Chart === 'undefined') {
        setTimeout(() => updateChart(filteredData), 200);
        return;
    }

    if (!canvas) return;

    if (expenseChart) {
        expenseChart.destroy();
        expenseChart = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Agrupar totais por categoria
    const categories = ['Água', 'Energia', 'Internet', 'Aluguel', 'Mercado', 'Seguro da Moto', 'Seguro de Carro', 'Cartão de Crédito', 'Lazer', 'Gasolina', 'Outros'];
    const data = filteredData || [];
    const totals = categories.map(cat => {
        return data
            .filter(exp => exp.category === cat && exp.isPaid)
            .reduce((sum, exp) => sum + (exp.amount || 0), 0);
    });

    const hasData = totals.some(t => t > 0);
    const emptyChartMessage = {
        id: 'emptyChartMessage',
        afterDraw(chart) {
            if (hasData) return;

            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.fillStyle = '#7f8c8d';
            ctx.font = '14px Segoe UI, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Sem gastos neste mês', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
            ctx.restore();
        }
    };

    expenseChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Total Gasto (R$)',
                data: totals,
                backgroundColor: [
                    '#3498db', // Água
                    '#f1c40f', // Energia
                    '#2ecc71', // Internet
                    '#e67e22', // Aluguel
                    '#1abc9c', // Mercado
                    '#607d8b', // Seguro da Moto
                    '#795548', // Seguro de Carro
                    '#e74c3c', // Cartão de Crédito
                    '#9b59b6', // Lazer
                    '#f39c12', // Gasolina
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
        },
        plugins: [emptyChartMessage]
    });
}

function updateUI() {
    // Limpa o timeout anterior para evitar múltiplas atualizações pesadas
    if (updateTimeout) clearTimeout(updateTimeout);
    
    updateCalculationsOnly();

    // Agenda a atualização pesada (tabela e gráfico) para 300ms depois
    updateTimeout = setTimeout(() => {
        renderTableAndChart();
    }, 300);
}

function updateCalculationsOnly() {
    const filtered = getFilteredExpenses();
    const totalPaid = filtered.filter(exp => exp.isPaid).reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalCommitted = filtered.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    
    // Renda Total
    const totalIncome = budget + extraIncome;

    // Saldo Projetado: Orçamento Fixo - Todos os gastos do mês (Planejamento real)
    const finalReserve = budget - totalCommitted;
    
    const reserveEl = document.getElementById('final-reserve');
    reserveEl.innerText = formatCurrency(finalReserve);
    reserveEl.style.color = finalReserve >= 0 ? '#1f7a55' : 'var(--danger)';

    // Atualiza Barra de Progresso
    const percent = totalIncome > 0 ? Math.min((totalCommitted / totalIncome) * 100, 100) : 0;
    
    const menuProgressBar = document.getElementById('menu-progress-bar');
    const menuProgressText = document.getElementById('menu-progress-text');
    
    if (menuProgressBar) menuProgressBar.style.width = percent + '%';
    if (menuProgressBar) menuProgressBar.style.backgroundColor = percent > 90 ? 'var(--danger)' : (percent > 70 ? '#e67e22' : 'var(--success)');
    if (menuProgressText) menuProgressText.innerText = `${percent.toFixed(1)}%`;

    // Atualiza Barra de Meta de Economia (Baseado no Saldo na Carteira)
    const goalStatus = document.getElementById('goal-status');
    const goalBar = document.getElementById('goal-bar');

    if (savingsGoal > 0) {
        const goalPercent = Math.min(Math.max((walletValue / savingsGoal) * 100, 0), 100);
        goalBar.style.width = goalPercent + '%';
        goalBar.style.backgroundColor = goalPercent >= 100 ? 'var(--success)' : 'var(--primary)';
        goalStatus.innerText = goalPercent >= 100 ? "Meta alcançada!" : `${goalPercent.toFixed(0)}% da meta`;
    } else {
        goalBar.style.width = '0%';
        goalStatus.innerText = "Sem meta definida";
    }
}

function renderTableAndChart() {
    expensesList.innerHTML = '';
    const filtered = getFilteredExpenses();

    // Calcula os totais do mês selecionado para atualizar os cards de resumo corretamente
    const totalPaid = filtered.filter(exp => exp.isPaid).reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const fixedTotal = filtered.filter(exp => exp.isFixed).reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const variableTotal = filtered.filter(exp => !exp.isFixed).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const categoryIcons = {
        'Água': '💧',
        'Energia': '⚡',
        'Internet': '🌐',
        'Aluguel': '🏠',
        'Mercado': '🛒',
        'Seguro da Moto': '🏍️',
        'Seguro de Carro': '🚗',
        'Cartão de Crédito': '💳',
        'Lazer': '🎡',
        'Gasolina': '⛽',
        'Outros': '📁'
    };

    // Separação de Gastos Fixos e Variáveis/Parcelados
    const fixedExpenses = filtered.filter(exp => exp.isFixed);
    const otherExpenses = filtered.filter(exp => !exp.isFixed);

    const groupedExpenses = [];
    const processedGroups = new Set();
    const currentMonthStr = document.getElementById('month-filter').value;

    // Processa apenas gastos que não são fixos mensais (parcelas e avulsos)
    otherExpenses.forEach(exp => {
        if (exp.groupId && !processedGroups.has(exp.groupId)) {
            const groupItems = expenses.filter(e => e.groupId === exp.groupId);
            
            // Ordena as parcelas por data de forma crescente (1/36, 2/36...)
            groupItems.sort((a, b) => {
                const parse = (s) => {
                    const p = s.split(/[-/]/);
                    return p[0].length === 4 ? new Date(p[0], p[1]-1, p[2]) : new Date(p[2], p[1]-1, p[0]);
                };
                return parse(a.date) - parse(b.date);
            });

            groupedExpenses.push({
                type: 'group',
                groupId: exp.groupId,
                category: exp.category,
                baseDescription: exp.description.split(' (')[0],
                items: groupItems,
                totalAmount: groupItems.reduce((sum, item) => sum + item.amount, 0)
            });
            processedGroups.add(exp.groupId);
        } else if (!exp.groupId) {
            groupedExpenses.push({ type: 'single', ...exp });
        }
    });

    groupedExpenses.forEach(item => {
        if (item.type === 'single') {
            renderRow(item, expensesList, categoryIcons);
        } else {
            // Renderiza Linha de Resumo do Grupo
            renderGroupSummary(item, expensesList, categoryIcons, currentMonthStr);
            
            const isExpanded = expandedGroups.has(item.groupId);
            
            const wrapperTr = document.createElement('tr');
            wrapperTr.className = `installment-row-${item.groupId} ${isExpanded ? '' : 'hidden'} installments-wrapper-row`;
            
            const wrapperTd = document.createElement('td');
            wrapperTd.colSpan = 6;
            
            const scrollDiv = document.createElement('div');
            scrollDiv.className = 'installments-scroll-container';
            
            item.items.forEach(subItem => {
                renderInstallmentBlock(subItem, scrollDiv);
            });
            
            wrapperTd.appendChild(scrollDiv);
            wrapperTr.appendChild(wrapperTd);
            expensesList.appendChild(wrapperTr);
        }
    });

    // Renderiza a Seção de Contas Fixas Mensais ao final
    if (fixedExpenses.length > 0) {
        const fixedGroupId = 'fixed-monthly-group';
        const isExpanded = expandedGroups.has(fixedGroupId);
        
        const trHeader = document.createElement('tr');
        trHeader.className = 'group-header-row fixed-group-header';
        trHeader.innerHTML = `
            <td colspan="3" style="font-weight: bold; color: #64748b; font-size: 0.8rem; letter-spacing: 0.5px;">
                📌 CONTAS FIXAS MENSAIS (${fixedExpenses.length})
            </td>
            <td colspan="2"></td>
            <td style="text-align: right;">
                <button data-group="${fixedGroupId}" class="btn-toggle-group" style="background: transparent; border: none; color: var(--primary); cursor: pointer; text-decoration: underline; font-size: 0.75rem; font-weight: bold;">
                    ${isExpanded ? 'Ocultar' : 'Ver Detalhes'}
                </button>
            </td>
        `;
        expensesList.appendChild(trHeader);

        fixedExpenses.forEach(exp => {
            // Renderiza as linhas das contas fixas com a classe hidden se não estiver expandido
            renderRow(exp, expensesList, categoryIcons, `fixed-row ${isExpanded ? '' : 'hidden'} installment-row-${fixedGroupId}`);
        });
    }

    document.getElementById('total-spent').innerText = formatCurrency(totalPaid);
    document.getElementById('fixed-total').innerText = formatCurrency(fixedTotal);
    document.getElementById('variable-total').innerText = formatCurrency(variableTotal);

    // Lógica da Meta de Economia
    updateCalculationsOnly();
    updateChart(filtered);
}

function renderRow(exp, container, icons, extraClass = '') {
    const icon = icons[exp.category] || '';
    const tr = document.createElement('tr');
    if (extraClass) tr.className = extraClass;
    tr.innerHTML = `
        <td>
            <div style="display: flex; flex-direction: column; line-height: 1.2;">
                <span style="font-weight: inherit;">${exp.description}</span>
                <span style="font-size: 0.75rem; color: #7f8c8d; font-weight: normal;">${exp.date}</span>
            </div>
        </td>
        <td style="display: flex; align-items: center; gap: 8px;"><span>${icon}</span> ${exp.category}</td>
        <td>${exp.isFixed ? `<span class="badge-fixed">Fixa Mensal ${exp.dueDay ? `(Todo dia ${exp.dueDay})` : ''}</span>` : '<span class="badge-once">1x</span>'}</td>
        <td>${formatCurrency(exp.amount || 0)}</td>
        <td>${exp.receipt ? `<a href="${exp.receipt}" target="_blank">Ver</a>` : '-'}</td>
        <td style="display: flex; gap: 3px; justify-content: flex-end;">
            <button data-id="${exp.id}" class="btn-paid ${exp.isPaid ? 'paid' : ''}" title="Alternar Status">${exp.isPaid ? '✅' : '⏳'}</button>
            <button data-id="${exp.id}" class="btn-delete btn-danger">X</button>
        </td>
    `;
    container.appendChild(tr);
}

function renderInstallmentBlock(exp, container) {
    const div = document.createElement('div');
    div.className = `installment-block ${exp.isPaid ? 'is-paid' : ''}`;
    div.innerHTML = `
        <div class="installment-info">
            <span class="installment-desc">${exp.description}</span>
            <span class="installment-date">${exp.date}</span>
        </div>
        <div class="installment-meta">
            <span class="installment-amount">${formatCurrency(exp.amount || 0)}</span>
            <div class="installment-actions">
                ${exp.receipt ? `<a href="${exp.receipt}" target="_blank" class="btn-receipt">📄</a>` : ''}
                <button data-id="${exp.id}" class="btn-paid ${exp.isPaid ? 'paid' : ''}" title="Alternar Status">${exp.isPaid ? '✅' : '⏳'}</button>
                <button data-id="${exp.id}" class="btn-delete btn-danger">X</button>
            </div>
        </div>
    `;
    container.appendChild(div);
}

function renderGroupSummary(group, container, icons, currentMonth) {
    const icon = icons[group.category] || '';
    const paidCount = group.items.filter(i => i.isPaid).length;
    const totalCount = group.items.length;
    const isExpanded = expandedGroups.has(group.groupId);

    const tr = document.createElement('tr');
    tr.className = 'group-header-row';
    tr.innerHTML = `
        <td style="font-weight: bold;">📦 ${group.baseDescription} (Parcelado)</td>
        <td><span>${icon}</span> ${group.category}</td>
        <td><span class="badge-once">${paidCount}/${totalCount} Pagas</span></td>
        <td>${formatCurrency(group.totalAmount)}</td>
        <td>-</td>
        <td style="text-align: right;">
            <div style="display: flex; gap: 3px; justify-content: flex-end;">
                <button data-group="${group.groupId}" class="btn-toggle-group btn-primary" style="padding: 5px 10px;">${isExpanded ? 'Ocultar todas as parcelas' : 'Todas as parcelas'}</button>
                <button data-group="${group.groupId}" class="btn-delete-group btn-danger" title="Excluir todas as parcelas">X</button>
            </div>
        </td>
    `;
    container.appendChild(tr);
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
