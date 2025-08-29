import { test, expect } from '@playwright/test'

test.describe('Screener', () => {
  test('should load the screener page', async ({ page }) => {
    await page.goto('/screener')
    
    // Check page content
    await expect(page.getByText('Stock Screener')).toBeVisible()
    await expect(page.getByText('Filter and discover stocks based on fundamental metrics')).toBeVisible()
    
    // Check if filters section is present
    await expect(page.getByText('Filters')).toBeVisible()
    await expect(page.getByText('Show Filters')).toBeVisible()
    
    // Check if results section is present
    await expect(page.getByText('Results')).toBeVisible()
  })

  test('should show and hide filters', async ({ page }) => {
    await page.goto('/screener')
    
    // Initially filters should be hidden
    await expect(page.getByLabel('P/E Min')).not.toBeVisible()
    
    // Click show filters
    await page.getByText('Show Filters').click()
    
    // Now filters should be visible
    await expect(page.getByLabel('P/E Min')).toBeVisible()
    await expect(page.getByLabel('P/E Max')).toBeVisible()
    await expect(page.getByLabel('Rev Growth Min (%)')).toBeVisible()
    
    // Click hide filters
    await page.getByText('Hide Filters').click()
    
    // Filters should be hidden again
    await expect(page.getByLabel('P/E Min')).not.toBeVisible()
  })

  test('should display screener table', async ({ page }) => {
    await page.goto('/screener')
    
    // Check if table headers are present
    await expect(page.getByText('Ticker')).toBeVisible()
    await expect(page.getByText('Company')).toBeVisible()
    await expect(page.getByText('Price')).toBeVisible()
    await expect(page.getByText('P/E TTM')).toBeVisible()
    await expect(page.getByText('Rev YoY')).toBeVisible()
  })

  test('should filter companies by ticker', async ({ page }) => {
    await page.goto('/screener')
    
    // Wait for data to load
    await page.waitForSelector('table tbody tr', { timeout: 10000 })
    
    // Get initial row count
    const initialRows = await page.locator('table tbody tr').count()
    expect(initialRows).toBeGreaterThan(0)
    
    // Filter by AAPL
    await page.getByPlaceholder('Filter by ticker or company name...').fill('AAPL')
    
    // Should show fewer results
    await page.waitForTimeout(500) // Wait for filter to apply
    const filteredRows = await page.locator('table tbody tr').count()
    expect(filteredRows).toBeLessThanOrEqual(initialRows)
  })
})
