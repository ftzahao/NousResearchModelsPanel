import { test, expect } from "bun:test"
import { reorderFavorites, sortByFavorites } from "./utils"

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

test("orders items by favorites drag order with non-favorites last", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }]
  // drag order: c first, then a
  const favorites = new Set(["c", "a"])
  expect(sortByFavorites(items, favorites).map((m) => m.id)).toEqual(["c", "a", "b"])
})

test("keeps non-favorites in their original relative order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }]
  const favorites = new Set(["c"])
  expect(sortByFavorites(items, favorites).map((m) => m.id)).toEqual(["c", "a", "b", "d"])
})

test("returns original order when favorites is empty", () => {
  const items = [{ id: "a" }, { id: "b" }]
  expect(sortByFavorites(items, new Set())).toEqual(items)
})
