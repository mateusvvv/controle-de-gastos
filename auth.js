import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const USERS = {
    'mat3usvvv619@gmail.com': 'Lucas',
    'daianegoncalves3441@gmail.com': 'Daiane',
    'elvisbezerracabralbj03@gmail.com': 'Elvis',
    'anapaulacabralbj@gmail.com': 'ANA'
};

document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, pass)
        .then(() => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            document.getElementById('error-message').innerText = 'E-mail ou senha incorretos.';
            console.error("Erro no login:", error);
        });
});

// Observador de estado de autenticação (Proteção de rota e UI)
onAuthStateChanged(auth, (user) => {
    const userDisplay = document.getElementById('user-display');
    const isIndex = window.location.pathname.includes('index.html');

    if (user) {
        const userName = USERS[user.email] || user.displayName || 'Usuário';
        if (userDisplay) userDisplay.innerText = userName;
        document.getElementById('menu-history')?.classList.remove('hidden');
    } else if (isIndex) {
        window.location.href = 'login.html';
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
    signOut(auth).then(() => {
        window.location.href = 'login.html';
    });
});