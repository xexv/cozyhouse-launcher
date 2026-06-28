// Cozy House Login Web Component
// Connects to the Cloudflare Worker D1 database API for login and registration.
// Fully supports English and Russian translation based on lang attribute.

class CozyLogin extends HTMLElement {
  constructor() {
    super();
    this.isLoading = false;
    this.isRegisterMode = false;
  }

  static get observedAttributes() {
    return ['lang'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'lang' && oldValue !== newValue) {
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const lang = this.getAttribute('lang') || 'ru';
    const isRu = lang === 'ru';

    this.innerHTML = `
      <div class="min-h-screen w-full flex flex-col lg:flex-row items-center justify-between p-4 sm:p-8 lg:p-16 xl:p-24 relative z-10 transition-all duration-500">
        
        <!-- Left Side: Welcome Panel -->
        <div class="w-full lg:w-[55%] flex flex-col justify-center text-center lg:text-left mt-8 lg:mt-0 mb-8 lg:mb-0 select-none animate-[fadeIn_0.8s_ease-out]">
          <h1 class="font-unbounded font-black text-white leading-[1.1] tracking-tight 
                     text-4xl sm:text-5xl md:text-6xl lg:text-[72px] xl:text-[84px] drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            ${isRu ? 'Добро<br class="hidden lg:inline"> пожаловать!' : 'Welcome<br class="hidden lg:inline"> back!'}
          </h1>
          <p class="mt-4 sm:mt-6 font-outfit text-[#a99c92] text-base sm:text-lg md:text-xl max-w-md mx-auto lg:mx-0 leading-relaxed">
            ${this.isRegisterMode 
              ? (isRu ? 'Создай аккаунт для игры в уютном мире Cozy House!' : 'Create an account to play in the cozy Cozy House world!') 
              : (isRu ? 'Авторизуйся, чтобы окунуться в теплый и уютный вайб выживания!' : 'Log in to dive into the warm and cozy survival vibe!')}
          </p>
        </div>

        <!-- Right Side: Login Card Container -->
        <div class="w-full lg:w-[45%] flex items-center justify-center animate-[fadeIn_0.8s_ease-out_0.2s_both]">
          <div class="w-full max-w-[440px] bg-[#1a1411]/80 backdrop-blur-xl border border-[#d4a373]/25 rounded-[28px] p-6 sm:p-10 lg:p-11 shadow-[0_0_50px_-12px_rgba(212,163,115,0.15)] transition-all duration-500 hover:shadow-[0_0_60px_-10px_rgba(212,163,115,0.22)] hover:border-[#d4a373]/35 relative overflow-hidden no-drag-region">
            
            <!-- Radial background glow inside the card -->
            <div class="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#d4a373]/8 blur-[60px] pointer-events-none"></div>
            <div class="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#e65d28]/4 blur-[60px] pointer-events-none"></div>

            <!-- Card Content Wrapper -->
            <div id="card-inner-container" class="relative z-10 transition-all duration-300">
              
              <!-- Header -->
              <div class="flex flex-col items-center mb-8">
                <!-- Cozy House Logo Box -->
                <div class="border border-[#d4a373]/30 rounded-[20px] p-3 w-16 h-16 flex items-center justify-center bg-[#251d18]/70 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)] mb-4 select-none">
                  <svg class="w-9 h-9 text-[#d4a373]" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 3L3 14H7V27C7 28.1 7.9 29 9 29H23C24.1 29 25 28.1 25 27V14H29L16 3Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <path d="M22 8V6H25V10.5" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <path d="M13 29V20H19V29" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
                    <rect x="13" y="11" width="6" height="5" rx="1" stroke="currentColor" stroke-width="2" />
                    <path d="M23.5 3.5C23.5 3 24 2.5 24.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
                  </svg>
                </div>
                <!-- Logo Text -->
                <div class="relative select-none">
                  <span class="font-unbounded font-black text-white text-2xl sm:text-3xl tracking-wider">COZY HOUSE</span>
                  <span class="absolute -top-1.5 -right-[34px] text-[8px] font-bold text-[#e63946] border border-[#e63946]/50 px-1.5 py-0.5 rounded-[6px] tracking-wide select-none uppercase">Alpha</span>
                </div>
              </div>

              <!-- Form -->
              <form id="login-form" class="space-y-6">
                <!-- Nickname Field -->
                <div>
                  <label for="username" class="block font-outfit text-[#a99c92] text-[13px] font-semibold tracking-wide uppercase mb-2 select-none">
                    ${isRu ? 'Никнейм' : 'Nickname'}
                  </label>
                  <div class="relative">
                    <input type="text" id="username" autocomplete="username" required
                      class="w-full px-5 py-4 bg-[#0e0a08]/90 border border-[#31251e] rounded-[16px] text-white font-outfit text-base placeholder-[#5c4e43] outline-none transition-all duration-300 focus:border-[#d4a373] focus:ring-2 focus:ring-[#d4a373]/15 hover:border-[#4d3b30]"
                      placeholder="${isRu ? 'Введите никнейм' : 'Enter nickname'}">
                  </div>
                </div>

                <!-- Password Field -->
                <div>
                  <label for="password" class="block font-outfit text-[#a99c92] text-[13px] font-semibold tracking-wide uppercase mb-2 select-none">
                    ${isRu ? 'Пароль' : 'Password'}
                  </label>
                  <div class="relative">
                    <input type="password" id="password" autocomplete="current-password" required
                      class="w-full px-5 py-4 bg-[#0e0a08]/90 border border-[#31251e] rounded-[16px] text-white font-outfit text-base placeholder-[#5c4e43] outline-none transition-all duration-300 focus:border-[#d4a373] focus:ring-2 focus:ring-[#d4a373]/15 hover:border-[#4d3b30]"
                      placeholder="${isRu ? 'Введите пароль' : 'Enter password'}">
                    <!-- Password Visibility Toggle -->
                    <button type="button" id="password-toggle" class="absolute right-4 top-1/2 -translate-y-1/2 text-[#5c4e43] hover:text-[#d4a373] transition-colors focus:outline-none">
                      <svg id="eye-icon" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path id="eye-open-path" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path id="eye-body-path" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Validation Error Message -->
                <div id="error-message" class="text-[#e76f51] text-xs font-outfit flex items-center space-x-1.5 hidden opacity-0 transition-all duration-300">
                  <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span id="error-text">Неверное имя пользователя или пароль.</span>
                </div>

                <!-- Action Row -->
                <div class="pt-2">
                  <button type="submit" id="submit-btn" class="w-full h-[52px] rounded-[16px] bg-[#d4a373] hover:bg-[#c69362] active:scale-[0.99] transition-all duration-300 flex items-center justify-between pl-2 pr-6 select-none cursor-pointer shadow-[0_4px_20px_-2px_rgba(212,163,115,0.3)] hover:shadow-[0_6px_24px_rgba(212,163,115,0.45)] group relative overflow-hidden">
                    <!-- Circle arrow/spinner -->
                    <div id="btn-circle" class="w-9 h-9 rounded-full bg-[#8f6848] flex items-center justify-center transition-all duration-300 group-hover:bg-[#725237] group-hover:scale-105 relative">
                      <!-- Chevron icon -->
                      <svg id="btn-chevron" class="w-4 h-4 text-white/90 group-hover:translate-x-0.5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <!-- Loading spinner -->
                      <svg id="btn-spinner" class="w-4 h-4 text-white animate-spin absolute opacity-0 scale-50 transition-all duration-300" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <!-- Button text -->
                    <span id="submit-btn-text" class="text-white font-outfit font-bold text-sm tracking-wider uppercase flex-grow text-center pr-3">
                      ${this.isRegisterMode 
                        ? (isRu ? 'Зарегистрироваться' : 'Register') 
                        : (isRu ? 'Авторизоваться' : 'Log In')}
                    </span>
                  </button>
                </div>
              </form>

              <!-- Switch login/register mode -->
              <button type="button" id="toggle-mode-btn" class="w-full text-center text-[10px] text-[#a99c92]/70 hover:text-[#d4a373] transition-colors mt-4 select-none font-bold uppercase tracking-wider cursor-pointer">
                ${this.isRegisterMode 
                  ? (isRu ? 'Уже есть аккаунт? Войти' : 'Already have an account? Log In') 
                  : (isRu ? 'Создать новый аккаунт' : 'Create new account')}
              </button>

            </div>
            
          </div>
        </div>
      </div>
    `;

    this.setupEventListeners();
  }

  setupEventListeners() {
    const pwToggle = this.querySelector('#password-toggle');
    const pwInput = this.querySelector('#password');
    if (pwToggle && pwInput) {
      pwToggle.addEventListener('click', () => {
        const isPassword = pwInput.type === 'password';
        pwInput.type = isPassword ? 'text' : 'password';
        
        const eyeOpen = this.querySelector('#eye-open-path');
        const eyeBody = this.querySelector('#eye-body-path');
        if (isPassword) {
          eyeOpen.setAttribute('d', 'M17.657 16.657L13.414 12.414m0 0L9.172 8.172m4.242 4.242L12 12m-3 0a3 3 0 11-6 0 3 3 0 016 0z');
          eyeBody.setAttribute('d', 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z M3 3l18 18');
        } else {
          eyeOpen.setAttribute('d', 'M15 12a3 3 0 11-6 0 3 3 0 016 0z');
          eyeBody.setAttribute('d', 'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z');
        }
      });
    }

    const toggleBtn = this.querySelector('#toggle-mode-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const u = this.querySelector('#username')?.value || '';
        const p = this.querySelector('#password')?.value || '';
        this.isRegisterMode = !this.isRegisterMode;
        this.render();
        this.querySelector('#username').value = u;
        this.querySelector('#password').value = p;
      });
    }

    const loginForm = this.querySelector('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }
  }

  showError(message) {
    const errorMsg = this.querySelector('#error-message');
    const errorText = this.querySelector('#error-text');
    if (errorMsg && errorText) {
      errorText.textContent = message;
      errorMsg.classList.remove('hidden');
      errorMsg.offsetHeight; // force reflow so CSS transition plays from opacity-0
      errorMsg.classList.remove('opacity-0');
      errorMsg.classList.add('opacity-100');

      const card = this.querySelector('.backdrop-blur-xl');
      if (card) {
        card.classList.add('animate-shake');
        setTimeout(() => card.classList.remove('animate-shake'), 500);
      }
    }
  }

  hideError() {
    const errorMsg = this.querySelector('#error-message');
    if (errorMsg) {
      errorMsg.classList.add('opacity-0');
      errorMsg.classList.remove('opacity-100');
      setTimeout(() => errorMsg.classList.add('hidden'), 300);
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    const submitBtn = this.querySelector('#submit-btn');
    const chevron = this.querySelector('#btn-chevron');
    const spinner = this.querySelector('#btn-spinner');
    const usernameInput = this.querySelector('#username');
    const pwInput = this.querySelector('#password');

    if (!submitBtn) return;

    if (loading) {
      submitBtn.classList.add('opacity-75', 'cursor-not-allowed', 'pointer-events-none');
      if (chevron) {
        chevron.classList.add('opacity-0', 'scale-50');
      }
      if (spinner) {
        spinner.classList.remove('opacity-0', 'scale-50');
        spinner.classList.add('opacity-100', 'scale-100');
      }
      if (usernameInput) usernameInput.disabled = true;
      if (pwInput) pwInput.disabled = true;
    } else {
      submitBtn.classList.remove('opacity-75', 'cursor-not-allowed', 'pointer-events-none');
      if (chevron) {
        chevron.classList.remove('opacity-0', 'scale-50');
      }
      if (spinner) {
        spinner.classList.add('opacity-0', 'scale-50');
        spinner.classList.remove('opacity-100', 'scale-100');
      }
      if (usernameInput) usernameInput.disabled = false;
      if (pwInput) pwInput.disabled = false;
    }
  }

  async handleLogin() {
    if (this.isLoading) return;
    this.hideError();

    const lang = this.getAttribute('lang') || 'ru';
    const isRu = lang === 'ru';

    const usernameVal = this.querySelector('#username').value.trim();
    const passwordVal = this.querySelector('#password').value;

    if (usernameVal.length < 3) {
      this.showError(isRu ? 'Никнейм должен быть не менее 3 символов.' : 'Nickname must be at least 3 characters.');
      return;
    }
    if (passwordVal.length < 4) {
      this.showError(isRu ? 'Пароль должен быть не менее 4 символов.' : 'Password must be at least 4 characters.');
      return;
    }

    this.setLoading(true);

    const API_URL = 'https://cozy-house-auth.8pfw45jj9c.workers.dev';

    try {
      if (this.isRegisterMode) {
        // Register API Call
        const registerRes = await fetch(`${API_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameVal, password: passwordVal })
        });
        const registerData = await registerRes.json();

        if (!registerRes.ok) {
          this.showError(registerData.error || (isRu ? 'Ошибка регистрации.' : 'Registration error.'));
          this.setLoading(false);
          return;
        }

        // Registration successful! Auto-login
        this.isRegisterMode = false;
        this.render();
        this.querySelector('#username').value = usernameVal;
        this.querySelector('#password').value = passwordVal;
      }

      // Login API Call
      const loginRes = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameVal, password: passwordVal })
      });
      const loginData = await loginRes.json();

      this.setLoading(false);

      if (!loginRes.ok) {
        this.showError(loginData.error || (isRu ? 'Неверный никнейм или пароль.' : 'Invalid nickname or password.'));
        return;
      }

      // Dispatch event to index.html with login response
      this.dispatchEvent(new CustomEvent('login-success', {
        detail: { 
          nickname: loginData.username,
          uuid: loginData.uuid,
          accessToken: loginData.accessToken,
          clientToken: loginData.clientToken,
          balance_coins: loginData.balance_coins,
          skin_url: loginData.skin_url
        },
        bubbles: true,
        composed: true
      }));

    } catch (err) {
      this.setLoading(false);
      this.showError(isRu ? 'Ошибка подключения к серверу.' : 'Connection to server failed.');
      console.error(err);
    }
  }
}

customElements.define('cozy-login', CozyLogin);
