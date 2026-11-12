package com.stockinsight.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api")
public class HistoryController {
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36";
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final ObjectMapper mapper;

    public HistoryController(ObjectMapper mapper) { this.mapper = mapper; }

    @GetMapping("/history")
    public Map<String, Object> history(@RequestParam(required = false) String symbol,
                                       @RequestParam(required = false) String ticker,
                                       @RequestParam(required = false) String range,
                                       @RequestParam(required = false) String interval) {
        String raw = symbol == null ? (ticker == null ? "" : ticker) : symbol;
        String normalized = normalizeTicker(raw);
        if (normalized == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter a valid ticker (e.g. AAPL).");
        String safeRange = normalizeRange(range);
        String safeInterval = normalizeInterval(interval);
        String encoded = URLEncoder.encode(normalized, StandardCharsets.UTF_8).replace("+", "%20");
        String url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encoded
                + "?range=" + safeRange + "&interval=" + safeInterval;
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20))
                    .header("User-Agent", USER_AGENT).GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not fetch market data.");
            }
            JsonNode root = mapper.readTree(response.body());
            JsonNode result = root.path("chart").path("result").path(0);
            if (result.isMissingNode() || result.isNull() || root.path("chart").path("error").isObject()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No data for \"" + raw + "\". Try another ticker or spelling.");
            }
            JsonNode timestamps = result.path("timestamp");
            JsonNode quote = result.path("indicators").path("quote").path(0);
            if (!timestamps.isArray() || !quote.isObject()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market data found for this ticker.");
            }
            List<Map<String, Object>> candles = new ArrayList<>();
            for (int i = 0; i < timestamps.size(); i++) {
                JsonNode closeNode = quote.path("close").path(i);
                if (!closeNode.isNumber()) continue;
                double close = closeNode.asDouble();
                long epoch = timestamps.path(i).asLong();
                String date = DateTimeFormatter.ISO_LOCAL_DATE.format(Instant.ofEpochSecond(epoch).atOffset(ZoneOffset.UTC));
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("date", date);
                candle.put("open", numberOr(quote.path("open").path(i), close));
                candle.put("high", numberOr(quote.path("high").path(i), close));
                candle.put("low", numberOr(quote.path("low").path(i), close));
                candle.put("close", close);
                candle.put("volume", Math.max(0, Math.round(numberOr(quote.path("volume").path(i), 0))));
                candles.add(candle);
            }
            if (candles.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No market data found for this ticker.");
            JsonNode meta = result.path("meta");
            String vendorSymbol = meta.path("symbol").asText(normalized).split("-")[0];
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("symbol", normalized);
            payload.put("candles", candles);
            payload.put("vendorSymbol", vendorSymbol);
            payload.put("currency", nullableText(meta.path("currency")));
            payload.put("exchangeName", nullableText(meta.path("exchangeName")));
            payload.put("timezone", nullableText(meta.path("exchangeTimezoneName")));
            payload.put("range", safeRange);
            payload.put("interval", safeInterval);
            return payload;
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not fetch market data.");
        }
    }

    private double numberOr(JsonNode node, double fallback) { return node.isNumber() ? node.asDouble() : fallback; }
    private String nullableText(JsonNode node) { return node.isTextual() ? node.asText() : null; }

    private String normalizeTicker(String value) {
        String s = value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace('-', '.').replaceAll("[^A-Z0-9.^]", "");
        if (s.isBlank()) return null;
        if (s.startsWith("^") || s.endsWith(".NS") || s.endsWith(".BO")) return s;
        return s + ".NS";
    }
    private String normalizeRange(String value) {
        Set<String> allowed = Set.of("1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max");
        String r = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return allowed.contains(r) ? r : "5y";
    }
    private String normalizeInterval(String value) {
        String i = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        return Set.of("1d", "1wk", "1mo").contains(i) ? i : "1d";
    }
}
