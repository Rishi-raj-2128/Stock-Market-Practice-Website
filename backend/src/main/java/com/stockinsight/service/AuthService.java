package com.stockinsight.service;

import com.stockinsight.model.UserAccount;
import com.stockinsight.repository.JsonUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class AuthService {
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private final JsonUserRepository users;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);

    public AuthService(JsonUserRepository users) { this.users = users; }

    public UserAccount signup(String rawEmail, String password) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (!EMAIL.matcher(email).matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid email.");
        if (password == null || password.length() < 6) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters.");
        if (users.findByEmail(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Account already exists. Try logging in.");
        UserAccount user = new UserAccount(UUID.randomUUID().toString(), email, encoder.encode(password), Instant.now().toString());
        users.save(user);
        return user;
    }

    public UserAccount login(String rawEmail, String password) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase();
        if (email.isBlank() || password == null || password.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email and password required.");
        }
        UserAccount user = users.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password."));
        if (!encoder.matches(password, user.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
        }
        return user;
    }

    public Map<String, Object> safeUser(UserAccount user) {
        return Map.of("id", user.id(), "email", user.email(), "createdAt", user.createdAt());
    }
}
