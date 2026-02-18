import { notifyOnMatchCheckbox } from './dom-elements.js';
export async function initializeNotifications() {
    if (!notifyOnMatchCheckbox) {
        return;
    }
    notifyOnMatchCheckbox.checked = false;
    notifyOnMatchCheckbox.disabled = true;
    notifyOnMatchCheckbox.title = 'Notifications are disabled in the FastAPI backend migration.';
}
