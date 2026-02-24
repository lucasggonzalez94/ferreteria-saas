export const alertColors = {
  critical: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
  warning: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
  info: "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800",
  success: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
  default: "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700",
};

export const textColors = {
  critical: "text-red-600 dark:text-red-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  info: "text-blue-600 dark:text-blue-400",
  success: "text-green-600 dark:text-green-400",
  muted: "text-gray-600 dark:text-gray-400",
};

export const getAlertColor = (level: string): string => {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return alertColors.critical;
    case "WARNING":
      return alertColors.warning;
    case "INFO":
      return alertColors.info;
    case "SUCCESS":
      return alertColors.success;
    default:
      return alertColors.default;
  }
};

export const getTextColor = (level: string): string => {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return textColors.critical;
    case "WARNING":
      return textColors.warning;
    case "INFO":
      return textColors.info;
    case "SUCCESS":
      return textColors.success;
    default:
      return textColors.muted;
  }
};
