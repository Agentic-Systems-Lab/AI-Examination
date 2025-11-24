/**
 * Text Utility Functions
 * 
 * This module provides utility functions for text manipulation,
 * including title truncation and formatting.
 * 
 * Author: AI Assistant
 */

/**
 * Truncates a text string to a specified length and adds ellipsis if needed
 * 
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation (default: 50)
 * @param addEllipsis - Whether to add "..." at the end (default: true)
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number = 50, addEllipsis: boolean = true): string {
  if (!text || text.length <= maxLength) {
    return text
  }
  
  const truncated = text.substring(0, maxLength).trim()
  return addEllipsis ? `${truncated}...` : truncated
}

/**
 * Truncates a title specifically for display in UI components
 * Uses different lengths based on context
 * 
 * @param title - The title to truncate
 * @param context - The context where the title will be displayed
 * @returns Truncated title appropriate for the context
 */
export function truncateTitle(title: string, context: 'card' | 'header' | 'list' | 'popup' = 'card'): string {
  if (!title) return ''
  
  const maxLengths = {
    card: 60,      // For material cards in upload page
    header: 40,    // For headers and navigation
    list: 30,      // For list items
    popup: 50      // For popup titles
  }
  
  return truncateText(title, maxLengths[context])
}

/**
 * Formats a title for display with proper capitalization
 * 
 * @param title - The title to format
 * @returns Formatted title
 */
export function formatTitle(title: string): string {
  if (!title) return ''
  
  // Remove file extensions and underscores, replace with spaces
  let formatted = title
    .replace(/\.(pdf|docx|doc|txt)$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
  
  // Capitalize first letter of each word
  return formatted
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Gets a display-friendly version of a title with truncation
 * 
 * @param title - The original title
 * @param context - The display context
 * @returns Formatted and truncated title
 */
export function getDisplayTitle(title: string, context: 'card' | 'header' | 'list' | 'popup' = 'card'): string {
  const formatted = formatTitle(title)
  return truncateTitle(formatted, context)
}



