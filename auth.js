const USERS = {
    'mat3usvvv619@gmail.com': 'Lucas',
    'daianegoncalves3441@gmail.com': 'Daiane',
    'elvisbezerracabralbj03@gmail.com': 'Elvis'
};
const ADMIN_PASS = '15112020';

document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    // Validação com base no mapeamento de usuários
    if (USERS[user] && pass === ADMIN_PASS) {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userName', USERS[user]);
        window.location.href = 'index.html';
    } else {
        document.getElementById('error-message').innerText = 'Usuário ou senha incorretos.';
    }
});

// Proteção de rota simplificada
if (window.location.pathname.includes('index.html')) {
    if (localStorage.getItem('isLoggedIn') !== 'true') {
        window.location.href = 'login.html';
    }
}

// Exibir nome do usuário logado na interface
document.addEventListener('DOMContentLoaded', () => {
    const userName = localStorage.getItem('userName');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userDisplay = document.getElementById('user-display');
    if (userDisplay && isLoggedIn && userName) {
        userDisplay.innerText = `Logado como ${userName}`;
        // Torna o link "Histórico de Gastos" visível para qualquer usuário logado
        const menuHistory = document.getElementById('menu-history');
        if (menuHistory) {
            menuHistory.classList.remove('hidden');
        }
    }
});

// Lógica do Menu Dropdown
const menuBtn = document.getElementById('menu-btn');
const dropdownMenu = document.getElementById('dropdown-menu');

menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.classList.toggle('show');
});

// Fechar menu ao clicar fora
window.addEventListener('click', () => {
    if (dropdownMenu?.classList.contains('show')) {
        dropdownMenu.classList.remove('show');
    }
});

// Elementos do Modal Admin
const adminModal = document.getElementById('admin-modal');
const sectionHome = document.getElementById('section-home');
const sectionAdmin = document.getElementById('section-admin');
const menuHistory = document.getElementById('menu-history');

// Navegação do Menu
document.getElementById('menu-home')?.addEventListener('click', () => {
    sectionHome.classList.remove('hidden');
    sectionAdmin.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

document.getElementById('menu-history')?.addEventListener('click', () => {
    sectionHome.classList.add('hidden');
    sectionAdmin.classList.remove('hidden');
});

document.getElementById('menu-admin')?.addEventListener('click', () => {
    if (!sectionAdmin.classList.contains('hidden')) {
        alert("Você já está no Painel Admin.");
        return;
    }
    adminModal.style.display = 'block';
});

document.getElementById('admin-close')?.addEventListener('click', () => {
    adminModal.style.display = 'none';
});

document.getElementById('admin-login-confirm')?.addEventListener('click', () => {
    const email = document.getElementById('admin-email').value;
    const pass = document.getElementById('admin-pass').value;

    if (USERS[email] && pass === ADMIN_PASS) {
        adminModal.style.display = 'none';
        sectionHome.classList.add('hidden');
        sectionAdmin.classList.remove('hidden');
        alert("Acesso concedido ao Painel Administrativo.");
        // Limpa campos
        document.getElementById('admin-email').value = '';
        document.getElementById('admin-pass').value = '';
    } else {
        alert("Credenciais administrativas incorretas!");
    }
});

document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userName');
    window.location.href = 'login.html';
});