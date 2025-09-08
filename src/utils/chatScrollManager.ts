import { RefObject } from 'react';

export class ChatScrollManager {
  private scrollContainer: RefObject<HTMLElement>;
  private isAtBottom = true;
  private shouldAutoScroll = true;
  private lastScrollTop = 0;
  private scrollThreshold = 100; // pixels from bottom to consider "at bottom"

  constructor(scrollContainer: RefObject<HTMLElement>) {
    this.scrollContainer = scrollContainer;
  }

  // Check if user is at the bottom of the chat
  private checkIfAtBottom(): boolean {
    const container = this.scrollContainer.current;
    if (!container) return false;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= this.scrollThreshold;
  }

  // Scroll to bottom smoothly
  scrollToBottom(smooth = true): void {
    const container = this.scrollContainer.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'instant'
    });
    this.isAtBottom = true;
  }

  // Handle scroll events
  handleScroll(): { shouldLoadMore: boolean; isAtBottom: boolean } {
    const container = this.scrollContainer.current;
    if (!container) return { shouldLoadMore: false, isAtBottom: false };

    const { scrollTop, scrollHeight, clientHeight } = container;
    const wasAtBottom = this.isAtBottom;
    
    // Update bottom status
    this.isAtBottom = this.checkIfAtBottom();
    
    // Determine if we should load more messages (when scrolled to top)
    const shouldLoadMore = scrollTop <= 200; // Load more when within 200px of top
    
    // Update auto-scroll preference based on user behavior
    if (!wasAtBottom && this.isAtBottom) {
      this.shouldAutoScroll = true;
    } else if (wasAtBottom && !this.isAtBottom) {
      this.shouldAutoScroll = false;
    }

    this.lastScrollTop = scrollTop;

    return {
      shouldLoadMore,
      isAtBottom: this.isAtBottom
    };
  }

  // Should we auto-scroll when new message arrives?
  shouldAutoScrollOnNewMessage(): boolean {
    return this.shouldAutoScroll && this.isAtBottom;
  }

  // Maintain scroll position when prepending messages (for loading older messages)
  maintainScrollPosition(callback: () => void): void {
    const container = this.scrollContainer.current;
    if (!container) {
      callback();
      return;
    }

    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;

    callback();

    // Restore scroll position after DOM update
    requestAnimationFrame(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const heightDifference = newScrollHeight - scrollHeight;
        container.scrollTop = scrollTop + heightDifference;
      }
    });
  }

  // Reset state when channel changes
  reset(): void {
    this.isAtBottom = true;
    this.shouldAutoScroll = true;
    this.lastScrollTop = 0;
  }

  // Get current state
  getState() {
    return {
      isAtBottom: this.isAtBottom,
      shouldAutoScroll: this.shouldAutoScroll
    };
  }

  // Force enable auto-scroll (useful when user sends a message)
  enableAutoScroll(): void {
    this.shouldAutoScroll = true;
  }
}

// Throttle function for scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};