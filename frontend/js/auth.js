document.addEventListener("DOMContentLoaded", () => {

  const signupForm = document.getElementById("signupForm");
  const loginForm = document.getElementById("loginForm");
  
  // Grab all the inputs for validation
  const fullNameInput = document.getElementById("signupFullName");
  const usernameInput = document.getElementById("signupUsername");
  const emailInput = document.getElementById("signupEmail");
  const phoneInput = document.getElementById("signupPhone");
  const passwordInput = document.getElementById("signupPassword");
  const confirmPasswordInput = document.getElementById("signupConfirmPassword");
  const strengthMeter = document.getElementById("passwordStrength");

  // ==========================================
  // FEATURE 1: Password Strength Tracker
  // ==========================================
  if (passwordInput && strengthMeter) {
    passwordInput.addEventListener("input", () => {
      const val = passwordInput.value;
      
      if (val.length === 0) {
        strengthMeter.textContent = "";
      } else if (val.length < 6) {
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

  // ==========================================
  // FEATURE 2: Sign Up Submission & Validation
  // ==========================================
  if (signupForm) {
    signupForm.addEventListener("submit", (e) => {
      e.preventDefault(); // Stop the form from submitting immediately

      // 1. Validate Full Name (Only letters and spaces)
      const nameRegex = /^[A-Za-z\s]+$/;
      if (!nameRegex.test(fullNameInput.value)) {
        alert("Full Name must contain only alphabetical letters and spaces.");
        fullNameInput.focus();
        return; 
      }

      // 2. Validate Username (Must contain at least one letter, one number, and no special chars)
      const usernameRegex = /^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9]+$/;
      if (!usernameRegex.test(usernameInput.value)) {
        alert("Username must be a mix of both letters and numbers.");
        usernameInput.focus();
        return;
      }

      // 3. Validate Email (Standard email format)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailInput.value)) {
        alert("Please enter a valid email address (e.g., user@gmail.com).");
        emailInput.focus();
        return;
      }

      // 4. Validate Phone Number (Exactly 10 digits)
      const phoneRegex = /^\d{10}$/;
      if (!phoneRegex.test(phoneInput.value)) {
        alert("Phone number must be exactly 10 digits.");
        phoneInput.focus();
        return;
      }

      // 5. Validate Passwords Match
      if (passwordInput.value !== confirmPasswordInput.value) {
        alert("Passwords do not match! Please try again.");
        confirmPasswordInput.value = "";
        confirmPasswordInput.focus();
        return; 
      }

      // ✅ 6. If everything passes, SEND DATA TO THE BACKEND!
      const userData = {
        fullName: fullNameInput.value,
        username: usernameInput.value,
        email: emailInput.value,
        phone: phoneInput.value,
        password: passwordInput.value // Send the raw password, backend will hash it!
      };

      // Send the request to your backend API
      fetch('http://localhost:5000/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          // If the backend sends an error (like "username already exists")
          alert("Error: " + data.error);
        } else {
          // If the backend successfully saved the user!
          alert("Account securely created! You can now login.");
          window.location.href = "login.html"; // Redirect to login page
        }
      })
      .catch(error => {
        console.error("Error connecting to server:", error);
        alert("Failed to connect to the server. Is your Node backend running?");
      });
    });
  }

  // ==========================================
  // FEATURE 3: Login Submission 
  // ==========================================
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      alert("Login successful (demo)");
      window.location.href = "dashboard.html";
    });
  }

});