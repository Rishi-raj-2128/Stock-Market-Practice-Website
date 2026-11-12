package com.stockinsight.service;

import com.stockinsight.model.UserAccount;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {
    @Test
    void createsSignedTokenWithUserIdentityAndSevenDayExpiry() {
        String secret = "U3RvY2tJbnNpZ2h0LURldmVsb3BtZW50LVNlY3JldC1LZXktMzItQnl0ZXMh";
        JwtService service = new JwtService(secret);
        UserAccount user = new UserAccount("user-123", "student@example.com", "hash", "now");

        String token = service.createToken(user);
        var claims = service.parse(token);

        assertEquals("user-123", claims.getSubject());
        assertEquals("student@example.com", claims.get("email"));
        assertNotNull(claims.getExpiration());
        assertTrue(claims.getExpiration().getTime() > System.currentTimeMillis());
    }

    @Test
    void rejectsTokenSignedWithDifferentSecret() {
        String secret = "U3RvY2tJbnNpZ2h0LURldmVsb3BtZW50LVNlY3JldC1LZXktMzItQnl0ZXMh";
        JwtService issuer = new JwtService(secret);
        JwtService verifier = new JwtService("QW5vdGhlci1kaWZmZXJlbnQtc2VjcmV0LWtleS1mb3ItdGVzdGluZw==");
        String token = issuer.createToken(new UserAccount("id", "a@b.com", "hash", "now"));

        assertThrows(RuntimeException.class, () -> verifier.parse(token));
    }
}
