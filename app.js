let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
let budget = parseFloat(localStorage.getItem('budget')) || 0;
let expenseChart = null;
let editingId = null;

const expenseForm = document.getElementById('expense-form');
const budgetInput = document.getElementById('monthly-budget');
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

    // Define o mês atual como padrão no filtro
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    document.getElementById('month-filter').value = currentMonth;
    
    updateUI();
});

budgetInput.addEventListener('input', applyMask);
budgetInput.addEventListener('change', (e) => {
    budget = parseCurrency(e.target.value);
    localStorage.setItem('budget', budget);
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

    if (editingId) {
        const index = expenses.findIndex(exp => exp.id === editingId);
        if (index !== -1) {
            expenses[index] = {
                ...expenses[index],
                description: document.getElementById('desc').value,
                amount: parseCurrency(document.getElementById('amount').value),
                category: document.getElementById('category').value,
                receipt: receiptData || expenses[index].receipt
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

    filtered.forEach(exp => {
        totalSpent += exp.amount;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${exp.description}</td>
            <td>${exp.category}</td>
            <td>${formatCurrency(exp.amount)}</td>
            <td>${exp.receipt ? `<a href="${exp.receipt}" target="_blank">Ver</a>` : '-'}</td>
            <td>
                <button onclick="editExpense(${exp.id})" class="btn-primary" style="padding: 5px 10px; margin-right: 5px;">Editar</button>
                <button onclick="deleteExpense(${exp.id})" class="btn-danger">X</button>
            </td>
        `;
        expensesList.appendChild(tr);
    });

    document.getElementById('total-spent').innerText = formatCurrency(totalSpent);
    const remaining = budget - totalSpent;
    const remainingEl = document.getElementById('remaining-balance');
    remainingEl.innerText = formatCurrency(remaining);
    remainingEl.className = remaining >= 0 ? 'positive' : 'negative';

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