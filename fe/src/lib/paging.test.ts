import { describe, expect, test } from "bun:test"
import { mergePages, PAGE_SIZE } from "./paging"

const item = (slug: string, tag = slug) => ({ slug, tag })

describe("paging", () => {
  test("every list asks for 15 items at a time", () => {
    expect(PAGE_SIZE).toBe(15)
  })

  test("mergePages joins the pages in order", () => {
    const pages = [{ items: [item("A"), item("B")] }, { items: [item("C")] }, { items: [] }, { items: [item("D")] }]

    expect(mergePages(pages).map((entry) => entry.slug)).toEqual(["A", "B", "C", "D"])
  })

  test("mergePages keeps the first copy of an item a later page repeats", () => {
    const pages = [{ items: [item("A", "first"), item("B")] }, { items: [item("B", "again"), item("C"), item("A", "again")] }]

    expect(mergePages(pages)).toEqual([item("A", "first"), item("B"), item("C")])
  })

  test("mergePages of no pages is empty", () => {
    expect(mergePages([])).toEqual([])
  })
})
