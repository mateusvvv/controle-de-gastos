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
    const path = window.location.pathname;
    const isIndex = path.endsWith('/') || path.includes('index.html');

    if (user) {
        const userName = USERS[user.email] || user.displayName || 'Usuário';
        if (userDisplay) userDisplay.innerText = userName;
        document.getElementById('menu-history')?.classList.remove('hidden');
    } else if (isIndex) {
        window.location.href = 'login.html';
    }
});

// Lógica unificada para menu e navegação
document.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('dropdown-menu') || document.querySelector('.dropdown-content');
    const sectionHome = document.getElementById('section-home');
    const sectionHistory = document.getElementById('section-history');
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
        sectionHistory?.classList.add('hidden');
        dropdownMenu?.classList.remove('show');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (typeof window.updateUI === 'function') window.updateUI();
    }

    // Navegação: Histórico de Gastos
    if (e.target.id === 'menu-history') {
        e.preventDefault();
        sectionHome?.classList.add('hidden');
        sectionHistory?.classList.remove('hidden');
        dropdownMenu?.classList.remove('show');
        if (typeof window.updateUI === 'function') window.updateUI();
    }

    // Botão Sair (Logout)
    if (e.target.id === 'logout-btn') {
        e.preventDefault();
        signOut(auth).then(() => {
            window.location.href = 'login.html';
        });
    }
});
