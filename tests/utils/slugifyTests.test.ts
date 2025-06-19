import { describe, it, expect } from "vitest";
import {
  slugify,
  createGroupSlug,
  extractGroupIdFromSlug,
  generateGroupUrl,
} from "~/lib/slugify";

// Test constants to avoid magic strings
const TEST_CASES = {
  SIMPLE_TEXT: "Hello World",
  SIMPLE_SLUG: "hello-world",

  ALPHANUMERIC_TEXT: "Budget Planning 123",
  ALPHANUMERIC_SLUG: "budget-planning-123",

  SPECIAL_CHARS_TEXT: "My Group! @#$%^&*()+={}[]|\\:;\"'<>,.?/~`",
  SPECIAL_CHARS_SLUG: "my-group",

  UNDERSCORES_TEXT: "test_group_name",
  UNDERSCORES_SLUG: "test_group_name",

  MIXED_CASE_TEXT: "MiXeD CaSe TeXt",
  MIXED_CASE_SLUG: "mixed-case-text",

  MULTIPLE_SPACES_TEXT: "Multiple    Spaces   Between    Words",
  MULTIPLE_SPACES_SLUG: "multiple-spaces-between-words",

  LEADING_TRAILING_SPACES_TEXT: "   Leading and Trailing   ",
  LEADING_TRAILING_SPACES_SLUG: "leading-and-trailing",

  NUMBERS_AND_LETTERS_TEXT: "Test123Group456",
  NUMBERS_AND_LETTERS_SLUG: "test123group456",

  UNICODE_TEXT: "Café & Restaurant",
  UNICODE_SLUG: "caf-restaurant",

  EMPTY_TEXT: "",
  EMPTY_SLUG: "",

  ONLY_SPECIAL_CHARS_TEXT: "!@#$%^&*()",
  ONLY_SPECIAL_CHARS_SLUG: "",

  ONLY_SPACES_TEXT: "   ",
  ONLY_SPACES_SLUG: "",

  DASHES_AND_UNDERSCORES_TEXT: "test-group_name-with_dashes",
  DASHES_AND_UNDERSCORES_SLUG: "test-group_name-with_dashes",

  VERY_LONG_TEXT:
    "This is a very long group name that should be truncated when creating a slug because it exceeds the maximum length limit that we have set for our slugs to ensure they work well in URLs and don't cause any issues with the database constraints",
} as const;

const TEST_IDS = {
  SINGLE_DIGIT: 1,
  DOUBLE_DIGIT: 42,
  TRIPLE_DIGIT: 123,
  LARGE_NUMBER: 999999,
  ZERO: 0,
} as const;

const EXPECTED_URLS = {
  SIMPLE: "/groups/hello-world-1",
  COMPLEX: "/groups/budget-planning-123-42",
} as const;

describe("slugify", () => {
  describe("Basic Functionality", () => {
    it("should convert simple text to lowercase slug", () => {
      const result = slugify(TEST_CASES.SIMPLE_TEXT);
      expect(result).toBe(TEST_CASES.SIMPLE_SLUG);
    });

    it("should handle alphanumeric text correctly", () => {
      const result = slugify(TEST_CASES.ALPHANUMERIC_TEXT);
      expect(result).toBe(TEST_CASES.ALPHANUMERIC_SLUG);
    });

    it("should preserve underscores", () => {
      const result = slugify(TEST_CASES.UNDERSCORES_TEXT);
      expect(result).toBe(TEST_CASES.UNDERSCORES_SLUG);
    });

    it("should handle mixed case text", () => {
      const result = slugify(TEST_CASES.MIXED_CASE_TEXT);
      expect(result).toBe(TEST_CASES.MIXED_CASE_SLUG);
    });

    it("should preserve numbers and letters", () => {
      const result = slugify(TEST_CASES.NUMBERS_AND_LETTERS_TEXT);
      expect(result).toBe(TEST_CASES.NUMBERS_AND_LETTERS_SLUG);
    });

    it("should preserve existing dashes and underscores", () => {
      const result = slugify(TEST_CASES.DASHES_AND_UNDERSCORES_TEXT);
      expect(result).toBe(TEST_CASES.DASHES_AND_UNDERSCORES_SLUG);
    });
  });

  describe("Space Handling", () => {
    it("should replace single spaces with dashes", () => {
      const result = slugify(TEST_CASES.SIMPLE_TEXT);
      expect(result).toBe(TEST_CASES.SIMPLE_SLUG);
    });

    it("should replace multiple spaces with single dash", () => {
      const result = slugify(TEST_CASES.MULTIPLE_SPACES_TEXT);
      expect(result).toBe(TEST_CASES.MULTIPLE_SPACES_SLUG);
    });

    it("should trim leading and trailing spaces", () => {
      const result = slugify(TEST_CASES.LEADING_TRAILING_SPACES_TEXT);
      expect(result).toBe(TEST_CASES.LEADING_TRAILING_SPACES_SLUG);
    });
  });

  describe("Special Character Handling", () => {
    it("should remove special characters", () => {
      const result = slugify(TEST_CASES.SPECIAL_CHARS_TEXT);
      expect(result).toBe(TEST_CASES.SPECIAL_CHARS_SLUG);
    });

    it("should handle unicode characters", () => {
      const result = slugify(TEST_CASES.UNICODE_TEXT);
      expect(result).toBe(TEST_CASES.UNICODE_SLUG);
    });

    it("should handle text with only special characters", () => {
      const result = slugify(TEST_CASES.ONLY_SPECIAL_CHARS_TEXT);
      expect(result).toBe(TEST_CASES.ONLY_SPECIAL_CHARS_SLUG);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty string", () => {
      const result = slugify(TEST_CASES.EMPTY_TEXT);
      expect(result).toBe(TEST_CASES.EMPTY_SLUG);
    });

    it("should handle string with only spaces", () => {
      const result = slugify(TEST_CASES.ONLY_SPACES_TEXT);
      expect(result).toBe(TEST_CASES.ONLY_SPACES_SLUG);
    });

    it("should not introduce leading or trailing dashes", () => {
      const result = slugify("!Hello World!");
      expect(result).toBe("hello-world");
      expect(result.startsWith("-")).toBe(false);
      expect(result.endsWith("-")).toBe(false);
    });

    it("should not have consecutive dashes", () => {
      const result = slugify("Hello!!!World");
      expect(result).toBe("hello-world");
      expect(result.includes("--")).toBe(false);
    });
  });

  describe("Type Safety", () => {
    it("should handle number input by converting to string", () => {
      const result = slugify(123 as unknown as string);
      expect(result).toBe("123");
    });

    it("should handle boolean input by converting to string", () => {
      const result = slugify(true as unknown as string);
      expect(result).toBe("true");
    });
  });
});

describe("createGroupSlug", () => {
  describe("Basic Functionality", () => {
    it("should create slug with name and ID", () => {
      const result = createGroupSlug(
        TEST_CASES.SIMPLE_TEXT,
        TEST_IDS.SINGLE_DIGIT,
      );
      expect(result).toBe(`${TEST_CASES.SIMPLE_SLUG}-${TEST_IDS.SINGLE_DIGIT}`);
    });

    it("should handle different ID sizes", () => {
      const singleDigit = createGroupSlug(
        TEST_CASES.SIMPLE_TEXT,
        TEST_IDS.SINGLE_DIGIT,
      );
      const doubleDigit = createGroupSlug(
        TEST_CASES.SIMPLE_TEXT,
        TEST_IDS.DOUBLE_DIGIT,
      );
      const tripleDigit = createGroupSlug(
        TEST_CASES.SIMPLE_TEXT,
        TEST_IDS.TRIPLE_DIGIT,
      );
      const largeNumber = createGroupSlug(
        TEST_CASES.SIMPLE_TEXT,
        TEST_IDS.LARGE_NUMBER,
      );

      expect(singleDigit).toBe("hello-world-1");
      expect(doubleDigit).toBe("hello-world-42");
      expect(tripleDigit).toBe("hello-world-123");
      expect(largeNumber).toBe("hello-world-999999");
    });

    it("should handle zero ID", () => {
      const result = createGroupSlug(TEST_CASES.SIMPLE_TEXT, TEST_IDS.ZERO);
      expect(result).toBe("hello-world-0");
    });
  });

  describe("Length Truncation", () => {
    it("should truncate very long slugs to 80 characters before adding ID", () => {
      const result = createGroupSlug(
        TEST_CASES.VERY_LONG_TEXT,
        TEST_IDS.SINGLE_DIGIT,
      );
      const baseSlugPart = result.substring(0, result.lastIndexOf("-"));

      expect(baseSlugPart.length).toBeLessThanOrEqual(80);
      expect(result.endsWith("-1")).toBe(true);
    });

    it("should preserve short slugs without truncation", () => {
      const shortName = "Short";
      const result = createGroupSlug(shortName, TEST_IDS.SINGLE_DIGIT);
      expect(result).toBe("short-1");
    });
  });

  describe("Special Cases", () => {
    it("should handle empty name with ID", () => {
      const result = createGroupSlug(
        TEST_CASES.EMPTY_TEXT,
        TEST_IDS.SINGLE_DIGIT,
      );
      expect(result).toBe("-1");
    });

    it("should handle name that becomes empty after slugification", () => {
      const result = createGroupSlug(
        TEST_CASES.ONLY_SPECIAL_CHARS_TEXT,
        TEST_IDS.SINGLE_DIGIT,
      );
      expect(result).toBe("-1");
    });
  });
});

describe("extractGroupIdFromSlug", () => {
  describe("Valid Slug Extraction", () => {
    it("should extract single digit ID", () => {
      const slug = "hello-world-1";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(1);
    });

    it("should extract multi-digit ID", () => {
      const slug = "budget-planning-123";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(123);
    });

    it("should extract large number ID", () => {
      const slug = "vacation-fund-999999";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(999999);
    });

    it("should extract zero ID", () => {
      const slug = "test-group-0";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(0);
    });
  });

  describe("Complex Slug Patterns", () => {
    it("should extract ID from slug with multiple dashes", () => {
      const slug = "my-awesome-group-name-with-many-dashes-42";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(42);
    });

    it("should extract ID from slug with underscores", () => {
      const slug = "test_group_name_with_underscores-123";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(123);
    });

    it("should handle slug that starts with dash", () => {
      const slug = "-special-case-456";
      const result = extractGroupIdFromSlug(slug);
      expect(result).toBe(456);
    });
  });

  describe("Error Cases", () => {
    it("should throw error for invalid slug format", () => {
      const invalidSlugs = [
        "no-numbers-here",
        "invalid-id-abc",
        "empty-id-",
        "not-a-number-NaN",
        "floating-point-12.5",
      ];

      invalidSlugs.forEach((slug) => {
        expect(() => extractGroupIdFromSlug(slug)).toThrow(
          `Invalid slug format: ${slug}`,
        );
      });
    });

    it("should throw error for empty slug", () => {
      expect(() => extractGroupIdFromSlug("")).toThrow("Invalid slug format: ");
    });

    it("should throw error for slug with only dashes", () => {
      expect(() => extractGroupIdFromSlug("---")).toThrow(
        "Invalid slug format: ---",
      );
    });
  });
});

describe("generateGroupUrl", () => {
  describe("URL Generation", () => {
    it("should generate correct URL for simple group", () => {
      const group = { id: 1, name: "Hello World" };
      const result = generateGroupUrl(group);
      expect(result).toBe(EXPECTED_URLS.SIMPLE);
    });

    it("should generate correct URL for complex group name", () => {
      const group = { id: 42, name: "Budget Planning 123" };
      const result = generateGroupUrl(group);
      expect(result).toBe(EXPECTED_URLS.COMPLEX);
    });

    it("should always start with /groups/", () => {
      const group = { id: 1, name: "Any Name" };
      const result = generateGroupUrl(group);
      expect(result.startsWith("/groups/")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle group with empty name", () => {
      const group = { id: 1, name: "" };
      const result = generateGroupUrl(group);
      expect(result).toBe("/groups/-1");
    });

    it("should handle group with special characters in name", () => {
      const group = { id: 123, name: "My Group! @#$%" };
      const result = generateGroupUrl(group);
      expect(result).toBe("/groups/my-group-123");
    });

    it("should handle zero ID", () => {
      const group = { id: 0, name: "Test Group" };
      const result = generateGroupUrl(group);
      expect(result).toBe("/groups/test-group-0");
    });
  });
});

describe("Integration Tests", () => {
  describe("Round Trip: Create and Extract", () => {
    const testCases = [
      { name: "Simple Group", id: 1 },
      { name: "Budget Planning", id: 42 },
      { name: "My Awesome Group!!!", id: 123 },
      { name: "test_group_with_underscores", id: 456 },
      { name: "Group-With-Existing-Dashes", id: 789 },
      { name: "Mixed123Numbers456", id: 999 },
    ];

    testCases.forEach(({ name, id }) => {
      it(`should create and extract ID correctly for "${name}" with ID ${id}`, () => {
        const slug = createGroupSlug(name, id);
        const extractedId = extractGroupIdFromSlug(slug);
        expect(extractedId).toBe(id);
      });
    });
  });

  describe("URL Generation and Parsing", () => {
    it("should generate URL that contains extractable slug", () => {
      const group = { id: 42, name: "Integration Test Group" };
      const url = generateGroupUrl(group);
      const slug = url.replace("/groups/", "");
      const extractedId = extractGroupIdFromSlug(slug);

      expect(extractedId).toBe(group.id);
    });
  });

  describe("Consistency Tests", () => {
    it("should maintain slug consistency across multiple calls", () => {
      const name = "Consistent Group";
      const id = 123;

      const slug1 = createGroupSlug(name, id);
      const slug2 = createGroupSlug(name, id);

      expect(slug1).toBe(slug2);
    });

    it("should generate different slugs for same name with different IDs", () => {
      const name = "Same Name";

      const slug1 = createGroupSlug(name, 1);
      const slug2 = createGroupSlug(name, 2);

      expect(slug1).not.toBe(slug2);
      expect(slug1).toBe("same-name-1");
      expect(slug2).toBe("same-name-2");
    });
  });
});
