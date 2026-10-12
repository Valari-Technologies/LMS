package com.onetutor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;

@org.springframework.scheduling.annotation.EnableScheduling
@SpringBootApplication
public class OneTutorApplication {

    public static void main(String[] args) {
        loadEnv();
        SpringApplication.run(OneTutorApplication.class, args);
    }

    private static void loadEnv() {
        File[] candidates = {
            new File(".env"),
            new File("../.env"),
            new File("../../.env")
        };
        for (File file : candidates) {
            if (file.exists() && file.isFile()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int eqIdx = line.indexOf('=');
                        if (eqIdx > 0) {
                            String key = line.substring(0, eqIdx).trim();
                            String val = line.substring(eqIdx + 1).trim();
                            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length() - 1);
                            }
                            if (key.equalsIgnoreCase("MAIL_PASSWORD") && val.contains(" ")) {
                                val = val.replaceAll("\\s+", "");
                            }
                            if (System.getProperty(key) == null && System.getenv(key) == null) {
                                System.setProperty(key, val);
                            }
                        }
                    }
                    System.out.println("✓ Loaded environment variables from: " + file.getAbsolutePath());
                    break;
                } catch (Exception e) {
                    System.err.println("Warning: Failed reading .env file: " + e.getMessage());
                }
            }
        }
    }
}
