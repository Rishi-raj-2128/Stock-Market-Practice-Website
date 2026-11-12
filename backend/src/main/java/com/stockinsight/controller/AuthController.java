package com.stockinsight.controller;

import com.stockinsight.model.UserAccount;
import com.stockinsight.repository.JsonUserRepository;
import com.stockinsight.security.JwtAuthFilter;
import com.stockinsight.service.AuthService;
import com.stockinsight.service.JwtService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final JwtService jwtService;
    private final JsonUserRepository users;
    private final boolean secureCookie;

    public AuthController(AuthService authService, JwtService jwtService, JsonUserRepository users,
                          @Value("${app.cookie-secure:false}") boolean secureCookie) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.users = users;
        this.secureCookie = secureCookie;
    }

    public record Credentials(String email, String password) {}

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Credentials body) {
        UserAccount user = authService.signup(body.email(), body.password());
        return withCookie(Map.of("user", authService.safeUser(user)), jwtService.createToken(user));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Credentials body) {
        UserAccount user = authService.login(body.email(), body.password());
        return withCookie(Map.of("user", authService.safeUser(user)), jwtService.createToken(user));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, "")
                .httpOnly(true).secure(secureCookie).sameSite("Lax").path("/").maxAge(Duration.ZERO).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(Map.of("ok", true));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        String token = cookieToken(request);
        if (token == null) return ResponseEntity.ok(Map.of("user", (Object) null));
        try {
            Claims claims = jwtService.parse(token);
            return users.findById(claims.getSubject())
                    .<ResponseEntity<?>>map(user -> ResponseEntity.ok(Map.of("user", authService.safeUser(user))))
                    .orElseGet(() -> ResponseEntity.ok(Map.of("user", (Object) null)));
        } catch (RuntimeException ex) {
            return ResponseEntity.ok(Map.of("user", (Object) null));
        }
    }

    private ResponseEntity<?> withCookie(Object body, String token) {
        ResponseCookie cookie = ResponseCookie.from(JwtAuthFilter.COOKIE_NAME, token)
                .httpOnly(true).secure(secureCookie).sameSite("Lax").path("/")
                .maxAge(Duration.ofDays(7)).build();
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookie.toString()).body(body);
    }

    private String cookieToken(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (var cookie : request.getCookies()) {
            if (JwtAuthFilter.COOKIE_NAME.equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
