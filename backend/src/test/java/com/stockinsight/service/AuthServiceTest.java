package com.stockinsight.service;

import com.stockinsight.model.UserAccount;
import com.stockinsight.repository.JsonUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AuthServiceTest {
    private JsonUserRepository repository;
    private AuthService service;

    @BeforeEach
    void setUp() {
        repository = mock(JsonUserRepository.class);
        service = new AuthService(repository);
    }

    @Test
    void signupHashesPasswordAndPersistsUser() {
        when(repository.findByEmail("student@example.com")).thenReturn(Optional.empty());

        UserAccount user = service.signup(" Student@Example.com ", "secret123");

        assertEquals("student@example.com", user.email());
        assertNotEquals("secret123", user.passwordHash());
        assertTrue(user.passwordHash().startsWith("$2"));
        verify(repository).save(user);
    }

    @Test
    void signupRejectsInvalidEmail() {
        assertThrows(ResponseStatusException.class, () -> service.signup("not-an-email", "secret123"));
        verify(repository, never()).save(any());
    }

    @Test
    void signupRejectsDuplicateEmail() {
        when(repository.findByEmail("student@example.com"))
                .thenReturn(Optional.of(new UserAccount("id", "student@example.com", "hash", "now")));

        assertThrows(ResponseStatusException.class, () -> service.signup("student@example.com", "secret123"));
        verify(repository, never()).save(any());
    }

    @Test
    void loginAcceptsCorrectPasswordAndRejectsWrongPassword() {
        String hash = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(10).encode("secret123");
        when(repository.findByEmail("student@example.com"))
                .thenReturn(Optional.of(new UserAccount("id", "student@example.com", hash, "now")));

        assertEquals("id", service.login("student@example.com", "secret123").id());
        assertThrows(ResponseStatusException.class, () -> service.login("student@example.com", "wrong-password"));
    }
}
