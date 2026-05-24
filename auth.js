import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const USERS = {
    'mat3usvvv619@gmail.com': 'Lucas',
    'daianegoncalves3441@gmail.com': 'Daiane',
    'elvisbezerracabralbj03@gmail.com': 'Elvis',
    'anapaulacabralbj@gmail.com': 'ANA'
};
const ADMIN_PASS = '15112020'; // Definindo a senha para evitar erro de referência

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

// Lógica Unificada para Menu, Navegação e Modal (Delegação de Eventos)
document.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('dropdown-menu') || document.querySelector('.dropdown-content');
    const sectionHome = document.getElementById('section-home');
    const sectionAdmin = document.getElementById('section-admin');
    const menuBtn = e.target.closest('#menu-btn');

    // Abrir/Fechar o Menu
    if (menuBtn) {
        e.preventDefault();
        dropdownMenu?.classList.toggle('show');
        return;
    }

    // Fechar menu ao clicar fora ou em itens (exceto se for o botão)
    if (dropdownMenu?.classList.contains('show') && !e.target.closest('.menu-container')) {
        dropdownMenu.classList.remove('show');
    }

    // Navegação: Início
    if (e.target.id === 'menu-home') {
        e.preventDefault();
        sectionHome?.classList.remove('hidden');
        sectionAdmin?.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Navegação: Histórico de Gastos
    if (e.target.id === 'menu-history') {
        e.preventDefault();
        sectionHome?.classList.add('hidden');
        sectionAdmin?.classList.remove('hidden');
    }

    // Botão Sair (Logout)
    if (e.target.id === 'logout-btn') {
        e.preventDefault();
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        });
    }

    // Fechar Modal Admin
    if (e.target.id === 'admin-close') {
        document.getElementById('admin-modal').style.display = 'none';
    }

    // Confirmar Login Admin
    if (e.target.id === 'admin-login-confirm') {
        const email = document.getElementById('admin-email').value;
        const pass = document.getElementById('admin-pass').value;
        if (USERS[email] && pass === ADMIN_PASS) {
            document.getElementById('admin-modal').style.display = 'none';
            sectionHome?.classList.add('hidden');
            sectionAdmin?.classList.remove('hidden');
            alert("Acesso concedido ao Painel Administrativo.");
        } else {
            alert("Credenciais administrativas incorretas!");
        }
    }
});