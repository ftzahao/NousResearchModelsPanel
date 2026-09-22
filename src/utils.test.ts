import { test, expect } from "bun:test"
import { reorderFavorites } from "./utils"

test("moves dragged id before target id", () => {
  expect(reorderFavorites(["a", "b", "c", "d"], "d", "b", "before")).toEqual([
    "a",
    "d",
    "b",
    "c"
  ])
})

test("moves dragged id after target id", () => {
  expect(reorderFavorites(["a", "b", "c", "d"], "a", "c", "after")).toEqual([
    "b",
    "c",
    "a",
    "d"
  ])
})

test("dragging forward onto the next item places it after the target", () => {
  // index math pitfall: removing "b" shifts "c" down before insertion
  expect(reorderFavorites(["a", "b", "c"], "b", "c", "after")).toEqual(["a", "c", "b"])
})

test("dragging backward onto the previous item places it before the target", () => {
  expect(reorderFavorites(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"])
})

test("returns order unchanged when ids are unknown", () => {
  expect(reorderFavorites(["a", "b"], "x", "b", "before")).toEqual(["a", "b"])
  expect(reorderFavorites(["a", "b"], "a", "y", "after")).toEqual(["a", "b"])
})

test("does not mutate the input array", () => {
  const input = ["a", "b", "c"]
  reorderFavorites(input, "c", "a", "before")
  expect(input).toEqual(["a", "b", "c"])
})
