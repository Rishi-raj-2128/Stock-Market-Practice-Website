package com.stockinsight.repository;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.stockinsight.model.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Repository
public class JsonUserRepository {
    private final ObjectMapper mapper;
    private final Path file;

    public JsonUserRepository(ObjectMapper mapper, @Value("${app.users-file:./data/users.json}") String file) {
        this.mapper = mapper;
        this.file = Path.of(file).toAbsolutePath().normalize();
    }

    public synchronized List<UserAccount> findAll() {
        try {
            ensureFile();
            JsonNode root = mapper.readTree(file.toFile());
            JsonNode users = root == null ? null : root.get("users");
            List<UserAccount> result = new ArrayList<>();
            if (users != null && users.isArray()) {
                for (JsonNode node : users) {
                    UserAccount user = mapper.treeToValue(node, UserAccount.class);
                    if (user != null) result.add(user);
                }
            }
            return result;
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read user data file.", ex);
        }
    }

    public synchronized Optional<UserAccount> findByEmail(String email) {
        return findAll().stream().filter(u -> u.email().equalsIgnoreCase(email)).findFirst();
    }

    public synchronized Optional<UserAccount> findById(String id) {
        return findAll().stream().filter(u -> u.id().equals(id)).findFirst();
    }

    public synchronized void save(UserAccount user) {
        List<UserAccount> users = findAll();
        if (users.stream().anyMatch(u -> u.email().equalsIgnoreCase(user.email()))) {
            throw new IllegalStateException("An account with this email already exists.");
        }
        users.add(user);
        ObjectNode root = mapper.createObjectNode();
        ArrayNode array = root.putArray("users");
        users.forEach(array::addPOJO);
        writeAtomically(root);
    }

    private void ensureFile() throws IOException {
        if (Files.notExists(file)) {
            Files.createDirectories(file.getParent());
            ObjectNode root = mapper.createObjectNode();
            root.putArray("users");
            mapper.writerWithDefaultPrettyPrinter().writeValue(file.toFile(), root);
        }
    }

    private void writeAtomically(JsonNode data) {
        try {
            Files.createDirectories(file.getParent());
            Path temp = file.resolveSibling(file.getFileName() + ".tmp");
            mapper.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), data);
            try {
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ex) {
                Files.move(temp, file, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to save user data.", ex);
        }
    }
}
