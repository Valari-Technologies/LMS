package com.onetutor.sections.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/** Ordered list of IDs — index in the list becomes the new display_order. */
public record ReorderRequest(@NotEmpty List<Long> orderedIds) {}
