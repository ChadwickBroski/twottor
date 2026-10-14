let notificationContainer;

function dismissNotification(toast, container) {
  if (toast.classList.contains("is-dismissing")) return;

  toast.classList.add("is-dismissing");
  toast.addEventListener("animationend", () => {
    const remainingToasts = [...container.children]
      .filter((item) => item !== toast)
      .map((item) => ({ element: item, top: item.getBoundingClientRect().top }));

    toast.remove();

    remainingToasts.forEach(({ element, top }) => {
      const offset = top - element.getBoundingClientRect().top;
      if (offset === 0) return;

      element.animate(
        [
          { transform: `translateY(${offset}px)` },
          { transform: "translateY(0)" },
        ],
        { duration: 160, easing: "ease-out" },
      );
    });

    if (container.childElementCount === 0) {
      container.remove();
      if (notificationContainer === container) notificationContainer = null;
    }
  }, { once: true });
}

export function notification(message, type = "info") {
  const notification = document.createElement("button");
  notification.type = "button";
  notification.className = "site-notification";
  const notificationType = ["success", "failure"].includes(type) ? type : "info";
  notification.classList.add(`site-notification--${notificationType}`);
  notification.setAttribute("aria-label", `Dismiss notification: ${message}`);
  notification.textContent = message;

  if (!notificationContainer) {
    notificationContainer = document.createElement("div");
    notificationContainer.className = "site-notifications";
    notificationContainer.setAttribute("aria-live", "polite");
    document.body.append(notificationContainer);
  }

  const container = notificationContainer;
  notification.addEventListener("click", () => {
    dismissNotification(notification, container);
  });
  container.append(notification);

  setTimeout(() => {
    dismissNotification(notification, container);
  }, 3500);
}
