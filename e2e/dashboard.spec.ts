import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('should load the main dashboard', async ({ page }) => {
    await page.goto('/')
    
    // Check if the page title is correct
    await expect(page).toHaveTitle(/Investing Dashboard/)
    
    // Check if navigation is present
    await expect(page.getByText('InvestDash')).toBeVisible()
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Screener')).toBeVisible()
    
    // Check if main content is loaded
    await expect(page.getByText('Investment Dashboard')).toBeVisible()
    await expect(page.getByText('Track your investments and discover new opportunities')).toBeVisible()
  })

  test('should navigate to screener page', async ({ page }) => {
    await page.goto('/')
    
    // Click on screener link
    await page.getByText('Screener').click()
    
    // Check if we're on the screener page
    await expect(page).toHaveURL('/screener')
    await expect(page.getByText('Stock Screener')).toBeVisible()
    await expect(page.getByText('Filter and discover stocks based on fundamental metrics')).toBeVisible()
  })

  test('should display KPI cards', async ({ page }) => {
    await page.goto('/')
    
    // Wait for data to load and check if KPI cards are visible
    await expect(page.getByText('Total Companies')).toBeVisible()
    await expect(page.getByText('Avg P/E Ratio')).toBeVisible()
    await expect(page.getByText('Positive Rev Growth')).toBeVisible()
    await expect(page.getByText('Avg Gross Margin')).toBeVisible()
  })

  test('should render charts', async ({ page }) => {
    await page.goto('/')
    
    // Check if chart containers are present
    await expect(page.getByText('Stock Prices')).toBeVisible()
    await expect(page.getByText('Top Revenue Growers')).toBeVisible()
    
    // Check if time range selector is present
    await expect(page.getByText('1Y')).toBeVisible()
  })
})
