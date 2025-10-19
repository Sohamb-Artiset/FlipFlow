import { toast } from 'sonner';

/**
 * Centralized error notification system to prevent duplicate error messages
 */
class ErrorNotificationManager {
  private static instance: ErrorNotificationManager;
  private activeNotifications = new Set<string>();
  private notificationTimeout = 5000; // 5 seconds

  static getInstance(): ErrorNotificationManager {
    if (!ErrorNotificationManager.instance) {
      ErrorNotificationManager.instance = new ErrorNotificationManager();
    }
    return ErrorNotificationManager.instance;
  }

  /**
   * Show error notification, preventing duplicates
   */
  showError(
    errorId: string,
    title: string,
    description: string,
    options: {
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    } = {}
  ): void {
    // Prevent duplicate notifications for the same error
    if (this.activeNotifications.has(errorId)) {
      return;
    }

    this.activeNotifications.add(errorId);

    const duration = options.duration || this.notificationTimeout;

    toast.error(title, {
      id: errorId,
      description,
      duration,
      action: options.action,
      onDismiss: () => {
        this.activeNotifications.delete(errorId);
      },
      onAutoClose: () => {
        this.activeNotifications.delete(errorId);
      },
    });

    // Cleanup after timeout
    setTimeout(() => {
      this.activeNotifications.delete(errorId);
    }, duration + 1000);
  }

  /**
   * Show success notification
   */
  showSuccess(
    title: string,
    description: string,
    options: {
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    } = {}
  ): void {
    toast.success(title, {
      description,
      duration: options.duration || 3000,
      action: options.action,
    });
  }

  /**
   * Show warning notification
   */
  showWarning(
    title: string,
    description: string,
    options: {
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    } = {}
  ): void {
    toast.warning(title, {
      description,
      duration: options.duration || 4000,
      action: options.action,
    });
  }

  /**
   * Show info notification
   */
  showInfo(
    title: string,
    description: string,
    options: {
      action?: {
        label: string;
        onClick: () => void;
      };
      duration?: number;
    } = {}
  ): void {
    toast.info(title, {
      description,
      duration: options.duration || 3000,
      action: options.action,
    });
  }

  /**
   * Dismiss a specific notification
   */
  dismiss(errorId: string): void {
    toast.dismiss(errorId);
    this.activeNotifications.delete(errorId);
  }

  /**
   * Dismiss all notifications
   */
  dismissAll(): void {
    toast.dismiss();
    this.activeNotifications.clear();
  }

  /**
   * Check if a notification is currently active
   */
  isActive(errorId: string): boolean {
    return this.activeNotifications.has(errorId);
  }

  /**
   * Get count of active notifications
   */
  getActiveCount(): number {
    return this.activeNotifications.size;
  }
}

// Export singleton instance
export const errorNotificationManager = ErrorNotificationManager.getInstance();

// Convenience functions
export const showErrorNotification = (
  errorId: string,
  title: string,
  description: string,
  options?: {
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }
) => errorNotificationManager.showError(errorId, title, description, options);

export const showSuccessNotification = (
  title: string,
  description: string,
  options?: {
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }
) => errorNotificationManager.showSuccess(title, description, options);

export const showWarningNotification = (
  title: string,
  description: string,
  options?: {
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }
) => errorNotificationManager.showWarning(title, description, options);

export const showInfoNotification = (
  title: string,
  description: string,
  options?: {
    action?: {
      label: string;
      onClick: () => void;
    };
    duration?: number;
  }
) => errorNotificationManager.showInfo(title, description, options);