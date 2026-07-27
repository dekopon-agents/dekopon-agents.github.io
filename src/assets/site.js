const root = document.documentElement;
const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const mobileNav = document.querySelector("[data-mobile-nav]");

root.classList.add("has-reveal");

const updateHeader = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 12);
};

updateHeader();
window.addEventListener("scroll", updateHeader, { passive: true });

const closeMenu = () => {
    if (!menuToggle || !mobileNav) return;

    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.querySelector(".sr-only").textContent = "Open navigation";
    mobileNav.hidden = true;
    header?.classList.remove("menu-active");
    document.body.classList.remove("menu-open");
};

const openMenu = () => {
    if (!menuToggle || !mobileNav) return;

    menuToggle.setAttribute("aria-expanded", "true");
    menuToggle.querySelector(".sr-only").textContent = "Close navigation";
    mobileNav.hidden = false;
    header?.classList.add("menu-active");
    document.body.classList.add("menu-open");
};

menuToggle?.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    isOpen ? closeMenu() : openMenu();
});

mobileNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
});

window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeMenu();
});

const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch {
            // Some browsers expose the API but deny it; use the legacy fallback.
        }
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();

    if (!copied) throw new Error("The browser denied clipboard access.");
};

document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
        try {
            await copyText(button.dataset.copy);
            const label = button.querySelector(".copy-label");
            button.classList.add("is-copied");
            if (label) label.textContent = "Copied";

            window.setTimeout(() => {
                button.classList.remove("is-copied");
                if (label) label.textContent = "Copy";
            }, 1800);
        } catch {
            const label = button.querySelector(".copy-label");
            if (label) label.textContent = "Select text";
        }
    });
});

const revealItems = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
        (entries, instance) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                instance.unobserve(entry.target);
            });
        },
        { rootMargin: "0px 0px -8%", threshold: 0.08 },
    );

    revealItems.forEach((item) => observer.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
}
