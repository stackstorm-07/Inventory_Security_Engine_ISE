document.addEventListener("DOMContentLoaded", () => {

  // ─── Element references ───────────────────────────────────────────────────
  const signupForm              = document.getElementById("signupForm");
  const loginForm               = document.getElementById("loginForm");
  const fullNameInput           = document.getElementById("signupFullName");
  const usernameInput           = document.getElementById("signupUsername");
  const emailInput              = document.getElementById("signupEmail");
  const phoneInput              = document.getElementById("signupPhone");
  const passwordInput           = document.getElementById("signupPassword");
  const confirmPasswordInput    = document.getElementById("signupConfirmPassword");
  const strengthMeter           = document.getElementById("passwordStrength");
  
  // Forgot Password / Reset Elements
  const forgotPasswordLink      = document.getElementById("forgotPasswordLink");
  const forgotPasswordBox       = document.getElementById("forgotPasswordBox");
  const forgotPasswordForm      = document.getElementById("forgotPasswordForm");
  const forgotEmailInput        = document.getElementById("forgotEmail");
  const resetPasswordBox        = document.getElementById("resetPasswordBox");
  const resetPasswordForm       = document.getElementById("resetPasswordForm");
  const resetEmailInput         = document.getElementById("resetEmail");
  const resetTokenInput         = document.getElementById("resetToken");
  const resetPasswordInput      = document.getElementById("resetPassword");
  const resetConfirmPasswordInput = document.getElementById("resetConfirmPassword");

  // 2FA / Login UI Switches
  const twoFactorForm           = document.getElementById("twoFactorForm");
  const formTitle               = document.getElementById("formTitle");
  const formSubtitle            = document.getElementById("formSubtitle");
  const forgotPasswordDiv       = document.getElementById("forgotPasswordDiv");
  const createAccountDiv        = document.getElementById("createAccountDiv");
  const backToLoginBtn          = document.getElementById("backToLoginBtn");

  // ─── CAPTCHA elements (only on login page) ───────────────────────────────
  const captchaCanvas  = document.getElementById("captchaCanvas");
  const captchaInput   = document.getElementById("captchaInput");
  const captchaError   = document.getElementById("captchaError");
  const refreshBtn     = document.getElementById("refreshCaptcha");

  // =========================================================================
  // TEXT CAPTCHA  — canvas-drawn, regex-validated, zero dependencies
  // =========================================================================
  const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CAPTCHA_LENGTH = 5;
  let currentCaptchaText = ""; 

  function generateCaptchaText() {
    let text = "";
    for (let i = 0; i < CAPTCHA_LENGTH; i++) {
      text += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    }
    return text;
  }

  function drawCaptcha(text) {
    if (!captchaCanvas) return;
    const ctx    = captchaCanvas.getContext("2d");
    const W      = captchaCanvas.width;   
    const H      = captchaCanvas.height;  
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#f0f4ff";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = `hsl(${Math.random() * 360}, 60%, 70%)`;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(Math.random() * W, Math.random() * H);
      ctx.lineTo(Math.random() * W, Math.random() * H);
      ctx.stroke();
    }
    const charW = W / (CAPTCHA_LENGTH + 1);
    for (let i = 0; i < text.length; i++) {
      ctx.save();
      const x = charW * (i + 0.8);
      const y = H / 2 + (Math.random() * 10 - 5);
      ctx.translate(x, y);
      ctx.rotate((Math.random() * 40 - 20) * (Math.PI / 180));
      ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 30%)`;
      ctx.font      = `bold ${20 + Math.random() * 4}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`;
      ctx.beginPath();
      ctx.arc(Math.random() * W, Math.random() * H, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function refreshCaptcha() {
    currentCaptchaText = generateCaptchaText();
    drawCaptcha(currentCaptchaText);
    if (captchaInput)  captchaInput.value = "";
    if (captchaError)  captchaError.textContent = "";
  }

  function validateCaptchaInput(userInput) {
    const trimmed = userInput.trim();
    const allowedCharsRegex = /^[A-Za-z2-9]+$/;
    if (!allowedCharsRegex.test(trimmed)) {
      return { ok: false, message: "CAPTCHA: only letters and digits 2–9 allowed." };
    }
    const exactLengthRegex = new RegExp(`^[A-Za-z2-9]{${CAPTCHA_LENGTH}}$`);
    if (!exactLengthRegex.test(trimmed)) {
      return { ok: false, message: `CAPTCHA must be exactly ${CAPTCHA_LENGTH} characters.` };
    }
    if (trimmed.toUpperCase() !== currentCaptchaText) {
      return { ok: false, message: "Incorrect CAPTCHA. Please try again." };
    }
    return { ok: true, message: "" };
  }

  if (captchaCanvas) refreshCaptcha();
  if (refreshBtn) refreshBtn.addEventListener("click", refreshCaptcha);
  if (captchaInput) {
    captchaInput.addEventListener("input", () => {
      if (captchaError) captchaError.textContent = "";
    });
  }

  // =========================================================================
  // FEATURE 1 — Password Strength Tracker
  // =========================================================================
  if (passwordInput && strengthMeter) {
    passwordInput.addEventListener("input", () => {
      const val = passwordInput.value;
      if (val.length === 0) { strengthMeter.textContent = ""; } 
      else if (val.length < 6) {
        strengthMeter.textContent = "Weak (Too short)";
        strengthMeter.style.color = "#dc2626";
      } else if (val.match(/[0-9]/) && val.match(/[a-zA-Z]/)) {
        if (val.length >= 8 && val.match(/[^a-zA-Z0-9]/)) {
          strengthMeter.textContent = "Strong";
          strengthMeter.style.color = "#16a34a";
        } else {
          strengthMeter.textContent = "Medium";
          strengthMeter.style.color = "#d97706";
        }
      } else {
        strengthMeter.textContent = "Weak (Add numbers and letters)";
        strengthMeter.style.color = "#dc2626";
      }
    });
  }

  // =========================================================================
  // FEATURE 2 — Sign Up
  // =========================================================================
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(fullNameInput.value)) { alert("Full Name must contain only alphabetical letters and spaces."); fullNameInput.focus(); return; }
      const usernameRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(usernameInput.value)) { alert("Username must be a mix of both letters and numbers."); usernameInput.focus(); return; }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value)) { alert("Please enter a valid email address."); emailInput.focus(); return; }
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneInput.value)) { alert("Phone number must be exactly 10 digits."); phoneInput.focus(); return; }
      if (passwordInput.value !== confirmPasswordInput.value) { alert("Passwords do not match!"); confirmPasswordInput.value = ""; confirmPasswordInput.focus(); return; }

      const userData = { fullName: fullNameInput.value, username: usernameInput.value, email: emailInput.value, phone: phoneInput.value, password: passwordInput.value };

      fetch("http://localhost:5000/api/auth/signup", {
        method:  "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(userData)
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) { alert("Error: " + data.error); }
        else { alert("Account securely created! You can now login."); window.location.href = "login.html"; }
      })
      .catch(() => alert("Failed to connect to the server. Is your Node backend running?"));
    });
  }

  // =========================================================================
  // FEATURE 3 — Login (with CAPTCHA, 2FA, and Back Button)
  // =========================================================================
  let tempUserId = null; // Store ID for 2FA verification

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const loginId   = document.getElementById("loginIdentifier").value;
      const loginPass = document.getElementById("loginPassword").value;

      // Validate CAPTCHA
      const captchaResult = validateCaptchaInput(captchaInput ? captchaInput.value : "");
      if (!captchaResult.ok) {
        if (captchaError) captchaError.textContent = captchaResult.message;
        refreshCaptcha();   
        captchaInput && captchaInput.focus();
        return;
      }

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.innerText = "Checking...";
      submitBtn.disabled = true;

      fetch("http://localhost:5000/api/auth/login", {
        method:  "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usernameOrEmail: loginId, password: loginPass })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          alert("Security Alert: " + data.error);
          refreshCaptcha();
        } else if (data.token) {
          // ADMIN/STAFF: 2FA BYPASSED, LOGIN IMMEDIATELY
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          window.location.href = "dashboard.html";
        } else if (data.requires2FA) {
          // STANDARD USER: Switch to 2FA Form
          tempUserId = data.userId;
          loginForm.style.display = "none";
          if (twoFactorForm) twoFactorForm.style.display = "block";
          if (formTitle) formTitle.innerText = "Verify Identity";
          if (formSubtitle) formSubtitle.innerText = "Two-Factor Authentication";
          if (forgotPasswordDiv) forgotPasswordDiv.style.display = "none";
          if (createAccountDiv) createAccountDiv.style.display = "none";
        }
      })
      .catch(() => alert("Failed to connect to the backend."))
      .finally(() => {
        submitBtn.innerText = "Login";
        submitBtn.disabled = false;
      });
    });
  }

  // Handle 2FA Verification
  if (twoFactorForm) {
    twoFactorForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const code = document.getElementById("twoFactorCode").value;
      const errorDisplay = document.getElementById("twoFactorError");
      const submitBtn = twoFactorForm.querySelector('button[type="submit"]');
      
      if (errorDisplay) errorDisplay.textContent = "";
      submitBtn.innerText = "Verifying...";
      submitBtn.disabled = true;

      fetch("http://localhost:5000/api/auth/verify-2fa", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: tempUserId, code: code })
      })
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          if (errorDisplay) errorDisplay.textContent = data.error;
        } else {
          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));
          window.location.href = "dashboard.html";
        }
      })
      .catch(() => {
        if (errorDisplay) errorDisplay.textContent = "Server error during verification.";
      })
      .finally(() => {
        submitBtn.innerText = "Verify & Login";
        submitBtn.disabled = false;
      });
    });
  }

  // BACK BUTTON LOGIC
  if (backToLoginBtn) {
    backToLoginBtn.addEventListener("click", () => {
      // Clear stored ID and 2FA input
      tempUserId = null;
      if (document.getElementById("twoFactorCode")) {
        document.getElementById("twoFactorCode").value = "";
      }
      if (document.getElementById("twoFactorError")) {
        document.getElementById("twoFactorError").textContent = "";
      }
      
      // Restore the UI
      if (twoFactorForm) twoFactorForm.style.display = "none";
      if (loginForm) loginForm.style.display = "block";
      if (formTitle) formTitle.innerText = "Login";
      if (formSubtitle) formSubtitle.innerText = "Access your account";
      if (forgotPasswordDiv) forgotPasswordDiv.style.display = "block";
      if (createAccountDiv) createAccountDiv.style.display = "block";
      
      // Generate a fresh CAPTCHA when they go back
      refreshCaptcha();
    });
  }

  // =========================================================================
  // FEATURE 4 — Forgot Password
  // =========================================================================
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      if (forgotPasswordBox) forgotPasswordBox.style.display = forgotPasswordBox.style.display === "none" ? "block" : "none";
      if (resetPasswordBox) resetPasswordBox.style.display = "none";
    });
  }

  if (forgotPasswordForm) {
    forgotPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = forgotEmailInput.value.trim();
      if (!email) { alert("Please enter your email address."); return; }

      try {
        const res  = await fetch("http://localhost:5000/api/auth/forgot-password", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email }) 
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Unable to request password reset."); return; }
        alert(data.message);
        if (forgotPasswordBox)  forgotPasswordBox.style.display = "none";
        if (resetPasswordBox)   resetPasswordBox.style.display  = "block";
        if (resetEmailInput)    resetEmailInput.value = email;
      } catch { alert("Unable to request password reset at this time."); }
    });
  }

  // =========================================================================
  // FEATURE 5 — Reset Password
  // =========================================================================
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email       = resetEmailInput.value.trim();
      const token       = resetTokenInput.value.trim();
      const newPassword = resetPasswordInput.value;
      const confirmPwd  = resetConfirmPasswordInput.value;

      if (!email || !token || !newPassword || !confirmPwd) { alert("Please complete all reset fields."); return; }
      if (newPassword !== confirmPwd) { alert("New passwords do not match."); return; }
      if (newPassword.length < 6)     { alert("New password must be at least 6 characters."); return; }

      try {
        const res  = await fetch("http://localhost:5000/api/auth/reset-password", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, token, newPassword })
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error || "Unable to reset password."); return; }
        alert(data.message);
        if (resetPasswordBox) resetPasswordBox.style.display = "none";
        if (loginForm)        loginForm.reset();
        refreshCaptcha();
      } catch { alert("Unable to reset password right now."); }
    });
  }
});