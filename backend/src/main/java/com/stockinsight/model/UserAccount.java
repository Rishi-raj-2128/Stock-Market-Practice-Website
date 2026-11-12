package com.stockinsight.model;

public record UserAccount(String id, String email, String passwordHash, String createdAt) {}
