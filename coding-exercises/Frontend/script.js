document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();  // Prevent form from submitting

    let username = document.getElementById('username').value;
    let password = document.getElementById('password').value;
    
    if (username === "" || password === "") {
        document.getElementById('error-message').style.display = 'block';
    } else {
        document.getElementById('error-message').style.display = 'none';
        alert("Login successful!");
        // You can redirect or perform further actions here
    }
});
