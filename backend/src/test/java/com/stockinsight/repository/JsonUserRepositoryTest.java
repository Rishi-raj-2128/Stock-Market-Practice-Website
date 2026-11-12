package com.stockinsight.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stockinsight.model.UserAccount;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class JsonUserRepositoryTest {
    @TempDir
    Path tempDir;

    @Test
    void createsJsonFileAndPersistsUserWithoutLosingFields() {
        Path file = tempDir.resolve("users.json");
        JsonUserRepository repository = new JsonUserRepository(new ObjectMapper(), file.toString());

        assertTrue(repository.findAll().isEmpty());
        UserAccount expected = new UserAccount("user-1", "student@example.com", "$2-hash", "2026-11-12T00:00:00Z");
        repository.save(expected);

        assertEquals(expected, repository.findByEmail("STUDENT@example.com").orElseThrow());
        assertEquals(expected, repository.findById("user-1").orElseThrow());
        assertEquals(1, repository.findAll().size());
    }

    @Test
    void rejectsDuplicateEmail() {
        JsonUserRepository repository = new JsonUserRepository(new ObjectMapper(), tempDir.resolve("users.json").toString());
        repository.save(new UserAccount("one", "student@example.com", "hash", "now"));

        assertThrows(IllegalStateException.class,
                () -> repository.save(new UserAccount("two", "STUDENT@example.com", "hash", "later")));
    }
}
