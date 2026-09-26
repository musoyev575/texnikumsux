// =========================================================
// 1-SON TEXNIKUMI — ADMIN PANEL JS
// =========================================================

"use strict";

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginMessage = document.getElementById("adminLoginMessage");
const adminUserEmail = document.getElementById("adminUserEmail");
const logoutBtn = document.getElementById("logoutBtn");

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showLoginMessage(text, type = "error") {
    adminLoginMessage.textContent = text;
    adminLoginMessage.className = `login-message ${type}`;
}

function showFormMessage(el, text, type = "error") {
    el.textContent = text;
    el.className = `admin-message show ${type}`;
}

function clearFormMessage(el) {
    el.textContent = "";
    el.className = "admin-message";
}

// =========================================================
// AUTENTIFIKATSIYA
// =========================================================

async function checkSession() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        showDashboard(data.session.user);
    } else {
        showLogin();
    }
}

function showLogin() {
    loginScreen.style.display = "flex";
    dashboardScreen.style.display = "none";
}

function showDashboard(user) {
    loginScreen.style.display = "none";
    dashboardScreen.style.display = "block";
    adminUserEmail.textContent = user.email || "";
    loadNewsList();
    loadCourseList();
}

adminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    if (!email || !password) {
        showLoginMessage("Email va parolni kiriting.", "error");
        return;
    }

    const submitBtn = document.getElementById("adminLoginSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Kirilmoqda...";
    showLoginMessage("Tekshirilmoqda...", "loading");

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    submitBtn.disabled = false;
    submitBtn.textContent = "Kirish";

    if (error) {
        showLoginMessage("Login yoki parol noto'g'ri.", "error");
        return;
    }

    showLoginMessage("Muvaffaqiyatli!", "success");
    showDashboard(data.user);
});

logoutBtn.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    showLogin();
});

checkSession();

// =========================================================
// TABLAR
// =========================================================

document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));

        tab.classList.add("active");
        document.getElementById(tab.dataset.tab).classList.add("active");
    });
});

// =========================================================
// RASM YUKLASH (Supabase Storage)
// =========================================================

async function uploadImage(file) {
    if (!file) return null;

    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabaseClient
        .storage
        .from("site-images")
        .upload(path, file);

    if (error) throw error;

    const { data } = supabaseClient
        .storage
        .from("site-images")
        .getPublicUrl(path);

    return data.publicUrl;
}

document.getElementById("newsImage").addEventListener("change", (event) => {
    const file = event.target.files[0];
    const preview = document.getElementById("newsImagePreview");

    if (!file) {
        preview.style.display = "none";
        return;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
});

// =========================================================
// YANGILIKLAR — CRUD
// =========================================================

const newsForm = document.getElementById("newsForm");
const newsFormMessage = document.getElementById("newsFormMessage");
const newsSubmitBtn = document.getElementById("newsSubmitBtn");
const newsCancelBtn = document.getElementById("newsCancelBtn");
const newsFormTitle = document.getElementById("newsFormTitle");

function resetNewsForm() {
    newsForm.reset();
    document.getElementById("newsId").value = "";
    document.getElementById("newsImagePreview").style.display = "none";
    newsSubmitBtn.textContent = "Qo'shish";
    newsFormTitle.textContent = "Yangi yangilik qo'shish";
    newsCancelBtn.style.display = "none";
    clearFormMessage(newsFormMessage);
}

newsCancelBtn.addEventListener("click", resetNewsForm);

newsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = document.getElementById("newsId").value;
    const title = document.getElementById("newsTitle").value.trim();
    const category = document.getElementById("newsCategory").value.trim();
    const news_date = document.getElementById("newsDate").value || null;
    const description = document.getElementById("newsDescription").value.trim();
    const file = document.getElementById("newsImage").files[0];

    if (!title) {
        showFormMessage(newsFormMessage, "Sarlavhani kiriting.", "error");
        return;
    }

    newsSubmitBtn.disabled = true;
    showFormMessage(newsFormMessage, "Saqlanmoqda...", "loading");

    try {
        let image_url;

        if (file) {
            image_url = await uploadImage(file);
        }

        const payload = { title, category, description };
        if (news_date) payload.news_date = news_date;
        if (image_url) payload.image_url = image_url;

        let error;

        if (id) {
            ({ error } = await supabaseClient.from("news").update(payload).eq("id", id));
        } else {
            ({ error } = await supabaseClient.from("news").insert(payload));
        }

        if (error) throw error;

        showFormMessage(newsFormMessage, "Saqlandi!", "success");
        resetNewsForm();
        loadNewsList();

    } catch (err) {
        console.error(err);
        showFormMessage(newsFormMessage, "Xatolik: " + err.message, "error");
    } finally {
        newsSubmitBtn.disabled = false;
    }
});

async function loadNewsList() {
    const list = document.getElementById("newsList");
    list.innerHTML = "<p class=\"admin-empty\">Yuklanmoqda...</p>";

    const { data, error } = await supabaseClient
        .from("news")
        .select("*")
        .order("news_date", { ascending: false });

    if (error) {
        list.innerHTML = `<p class="admin-empty">Xatolik: ${escapeHtml(error.message)}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = "<p class=\"admin-empty\">Hali yangiliklar yo'q.</p>";
        return;
    }

    list.innerHTML = data.map(item => `
        <div class="admin-row" data-id="${item.id}">
            ${item.image_url
                ? `<img src="${escapeHtml(item.image_url)}" alt="">`
                : `<div class="admin-row-icon">N</div>`}
            <div class="admin-row-body">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.category || "")} · ${escapeHtml(item.news_date || "")}</p>
            </div>
            <div class="admin-row-actions">
                <button class="edit-btn" data-action="edit-news" data-id="${item.id}">Tahrirlash</button>
                <button class="delete-btn" data-action="delete-news" data-id="${item.id}">O'chirish</button>
            </div>
        </div>
    `).join("");
}

document.getElementById("newsList").addEventListener("click", async (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;

    if (btn.dataset.action === "delete-news") {
        if (!confirm("Ushbu yangilikni o'chirmoqchimisiz?")) return;

        const { error } = await supabaseClient.from("news").delete().eq("id", id);
        if (error) {
            alert("Xatolik: " + error.message);
            return;
        }
        loadNewsList();
        return;
    }

    if (btn.dataset.action === "edit-news") {
        const { data, error } = await supabaseClient.from("news").select("*").eq("id", id).single();
        if (error || !data) return;

        document.getElementById("newsId").value = data.id;
        document.getElementById("newsTitle").value = data.title || "";
        document.getElementById("newsCategory").value = data.category || "";
        document.getElementById("newsDate").value = data.news_date || "";
        document.getElementById("newsDescription").value = data.description || "";

        const preview = document.getElementById("newsImagePreview");
        if (data.image_url) {
            preview.src = data.image_url;
            preview.style.display = "block";
        } else {
            preview.style.display = "none";
        }

        newsFormTitle.textContent = "Yangilikni tahrirlash";
        newsSubmitBtn.textContent = "Saqlash";
        newsCancelBtn.style.display = "inline-block";
        newsForm.scrollIntoView({ behavior: "smooth" });
    }
});

// =========================================================
// TA'LIM YO'NALISHLARI — CRUD
// =========================================================

const courseForm = document.getElementById("courseForm");
const courseFormMessage = document.getElementById("courseFormMessage");
const courseSubmitBtn = document.getElementById("courseSubmitBtn");
const courseCancelBtn = document.getElementById("courseCancelBtn");
const courseFormTitle = document.getElementById("courseFormTitle");

function resetCourseForm() {
    courseForm.reset();
    document.getElementById("courseId").value = "";
    courseSubmitBtn.textContent = "Qo'shish";
    courseFormTitle.textContent = "Yangi yo'nalish qo'shish";
    courseCancelBtn.style.display = "none";
    clearFormMessage(courseFormMessage);
}

courseCancelBtn.addEventListener("click", resetCourseForm);

courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = document.getElementById("courseId").value;
    const title = document.getElementById("courseTitle").value.trim();
    const icon = document.getElementById("courseIcon").value.trim();
    const description = document.getElementById("courseDescription").value.trim();

    if (!title) {
        showFormMessage(courseFormMessage, "Nomini kiriting.", "error");
        return;
    }

    courseSubmitBtn.disabled = true;
    showFormMessage(courseFormMessage, "Saqlanmoqda...", "loading");

    try {
        const payload = { title, icon, description };
        let error;

        if (id) {
            ({ error } = await supabaseClient.from("courses").update(payload).eq("id", id));
        } else {
            const { count } = await supabaseClient
                .from("courses")
                .select("*", { count: "exact", head: true });

            payload.sort_order = (count || 0) + 1;
            ({ error } = await supabaseClient.from("courses").insert(payload));
        }

        if (error) throw error;

        showFormMessage(courseFormMessage, "Saqlandi!", "success");
        resetCourseForm();
        loadCourseList();

    } catch (err) {
        console.error(err);
        showFormMessage(courseFormMessage, "Xatolik: " + err.message, "error");
    } finally {
        courseSubmitBtn.disabled = false;
    }
});

async function loadCourseList() {
    const list = document.getElementById("courseList");
    list.innerHTML = "<p class=\"admin-empty\">Yuklanmoqda...</p>";

    const { data, error } = await supabaseClient
        .from("courses")
        .select("*")
        .order("sort_order", { ascending: true });

    if (error) {
        list.innerHTML = `<p class="admin-empty">Xatolik: ${escapeHtml(error.message)}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        list.innerHTML = "<p class=\"admin-empty\">Hali yo'nalishlar yo'q.</p>";
        return;
    }

    list.innerHTML = data.map(item => `
        <div class="admin-row" data-id="${item.id}">
            <div class="admin-row-icon">${escapeHtml(item.icon || "?")}</div>
            <div class="admin-row-body">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.description || "")}</p>
            </div>
            <div class="admin-row-actions">
                <button class="edit-btn" data-action="edit-course" data-id="${item.id}">Tahrirlash</button>
                <button class="delete-btn" data-action="delete-course" data-id="${item.id}">O'chirish</button>
            </div>
        </div>
    `).join("");
}

document.getElementById("courseList").addEventListener("click", async (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;

    if (btn.dataset.action === "delete-course") {
        if (!confirm("Ushbu yo'nalishni o'chirmoqchimisiz?")) return;

        const { error } = await supabaseClient.from("courses").delete().eq("id", id);
        if (error) {
            alert("Xatolik: " + error.message);
            return;
        }
        loadCourseList();
        return;
    }

    if (btn.dataset.action === "edit-course") {
        const { data, error } = await supabaseClient.from("courses").select("*").eq("id", id).single();
        if (error || !data) return;

        document.getElementById("courseId").value = data.id;
        document.getElementById("courseTitle").value = data.title || "";
        document.getElementById("courseIcon").value = data.icon || "";
        document.getElementById("courseDescription").value = data.description || "";

        courseFormTitle.textContent = "Yo'nalishni tahrirlash";
        courseSubmitBtn.textContent = "Saqlash";
        courseCancelBtn.style.display = "inline-block";
        courseForm.scrollIntoView({ behavior: "smooth" });
    }
});
