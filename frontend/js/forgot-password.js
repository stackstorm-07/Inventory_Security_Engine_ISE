// --- CAPTCHA GENERATOR LOGIC ---
let currentCaptcha = "";

function generateCaptcha() {
    const canvas = document.getElementById('captchaCanvas');
    if (!canvas) {
        console.error("Could not find CAPTCHA canvas!");
        return;
    }
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw a light background
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Generate random 6-character string
    const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    currentCaptcha = "";
    for (let i = 0; i < 6; i++) {
        currentCaptcha += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Draw text
    ctx.font = "bold 24px Arial";
    ctx.fillStyle = "#1e293b"; // Dark text
    ctx.fillText(currentCaptcha, 25, 32);

    // Add noise lines to make it a real CAPTCHA
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.strokeStyle = "#9d2b8c"; // Purple lines
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

// Call generation immediately 
generateCaptcha();

// Attach refresh button event
const refreshBtn = document.getElementById("refreshCaptcha");
if (refreshBtn) {
    refreshBtn.addEventListener("click", generateCaptcha);
}

// --- STEP 1: Request Reset Code ---
document.getElementById('requestTokenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validate CAPTCHA first
    const userCaptcha = document.getElementById('captchaInput').value;
    const captchaError = document.getElementById('captchaError');
    
    // ✅ Make case-insensitive comparison (Both converted to lowercase)
    if (userCaptcha.toLowerCase() !== currentCaptcha.toLowerCase()) {
        captchaError.textContent = "Incorrect CAPTCHA. Please try again.";
        document.getElementById('captchaInput').value = ""; // Clear input
        generateCaptcha(); // Generate a new one
        return; // Stop form submission
    }
    
    captchaError.textContent = ""; // Clear error

    const identifier = document.getElementById('identifier').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    
    submitBtn.innerText = "Sending...";
    submitBtn.disabled = true;

    try {
        // ✅ UPDATED URL TO FIX JSON ERROR
        const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier })
        });

        const data = await response.json();

        if (response.ok) {
            alert(`Success! Your reset code is: ${data.resetCode}\n\n(In production, this will be emailed silently).`);
            
            document.getElementById('requestTokenSection').style.display = 'none';
            document.getElementById('resetPasswordSection').style.display = 'block';
            document.getElementById('formSubtitle').innerText = "Enter your reset code and new password.";
            
            // Auto-fill the identifier in the second form
            document.getElementById('resetIdentifier').value = identifier;
        } else {
            alert(data.error || "An error occurred. Account might not exist.");
            generateCaptcha(); // Refresh captcha on failure
            document.getElementById('captchaInput').value = "";
        }

    } catch (err) {
        alert("System Error: " + err.message);
        console.error("Full error:", err);
        generateCaptcha(); // Refresh captcha on failure
    } finally {
        submitBtn.innerText = "Send Reset Code";
        submitBtn.disabled = false;
    }
});

// --- STEP 2: Submit New Password ---
document.getElementById('resetPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const identifier = document.getElementById('resetIdentifier').value;
    const token = document.getElementById('resetToken').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword !== confirmPassword) {
        return alert("Passwords do not match!");
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.innerText = "Updating...";
    submitBtn.disabled = true;

    try {
        // ✅ UPDATED URL TO FIX JSON ERROR
        const response = await fetch('http://localhost:5000/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, token, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            alert("Password successfully reset! You will now be redirected to the login page.");
            window.location.href = 'login.html'; 
        } else {
            alert(data.error || "Invalid token or token expired.");
        }
    } catch (err) {
        alert("An error occurred during password reset.");
        console.error("Full error:", err);
    } finally {
        submitBtn.innerText = "Reset Password";
        submitBtn.disabled = false;
    }
});