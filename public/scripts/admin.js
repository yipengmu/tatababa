(() => {
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content ?? "";
  const loading = document.querySelector("[data-loading]");
  const errorBox = document.querySelector("[data-error]");
  const saveButton = document.querySelector("[data-save]");
  const saveStatus = document.querySelector("[data-save-status]");
  const toast = document.querySelector("[data-toast]");
  const panelTitles = {
    overview: "内容总览",
    profile: "人物首页",
    topics: "三个专题",
    entries: "内容与作品",
    channels: "关注入口",
    deployment: "发布设置"
  };
  const topicLabels = { career: "牛马职场", parenting: "育儿教育", life: "生活智慧" };
  const kindLabels = { series: "系列", article: "文章", product: "软件产品", game: "游戏", topic: "公众号专题" };
  const statusLabels = { published: "已发布", comingSoon: "待补充", draft: "草稿" };

  let content = null;
  let dirty = false;
  let editingEntryId = null;

  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const markDirty = () => {
    dirty = true;
    saveStatus.textContent = "有尚未保存的修改";
    saveStatus.classList.add("is-dirty");
  };

  const showToast = (message, type = "success") => {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.hidden = false;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  };

  const field = ({ label, value, onChange, type = "text", wide = false, rows = 4, options, help, dirtyOnChange = true }) => {
    const wrapper = element("label", `admin-field${wide ? " is-wide" : ""}`);
    wrapper.append(element("span", "field-label", label));
    let control;

    if (type === "textarea") {
      control = document.createElement("textarea");
      control.rows = rows;
      control.value = value ?? "";
    } else if (type === "select") {
      control = document.createElement("select");
      options.forEach((option) => {
        const optionNode = document.createElement("option");
        optionNode.value = option.value;
        optionNode.textContent = option.label;
        optionNode.selected = option.value === value;
        control.append(optionNode);
      });
    } else if (type === "checkbox") {
      wrapper.classList.add("is-checkbox");
      control = document.createElement("input");
      control.type = "checkbox";
      control.checked = Boolean(value);
    } else {
      control = document.createElement("input");
      control.type = type;
      control.value = value ?? "";
    }

    control.addEventListener(type === "checkbox" ? "change" : "input", () => {
      let nextValue = type === "checkbox" ? control.checked : control.value;
      if (type === "number") nextValue = Number(nextValue);
      onChange(nextValue);
      if (dirtyOnChange) markDirty();
    });
    wrapper.append(control);
    if (help) wrapper.append(element("small", "field-help", help));
    return wrapper;
  };

  const renderProfile = () => {
    const form = document.querySelector("[data-profile-form]");
    form.replaceChildren();
    const profile = content.profile;
    const definitions = [
      ["品牌名称", "brand"],
      ["首屏英文眉题", "eyebrow"],
      ["主标题第一行", "headline"],
      ["主标题强调行", "headlineAccent"],
      ["首屏个人介绍", "intro", "textarea", true],
      ["身份标签（逗号分隔）", "identityTags", "tags", true],
      ["关于我眉题", "aboutKicker"],
      ["关于我标题（换行保留）", "aboutTitle", "textarea", true],
      ["关于我正文", "aboutBody", "textarea", true],
      ["个人短句", "quote", "textarea", true]
    ];

    definitions.forEach(([label, key, fieldType = "text", wide = false]) => {
      const isTags = fieldType === "tags";
      form.append(
        field({
          label,
          value: isTags ? profile[key].join("，") : profile[key],
          type: fieldType === "textarea" ? "textarea" : "text",
          wide,
          rows: key === "aboutBody" ? 6 : 3,
          onChange: (value) => {
            profile[key] = isTags
              ? value.split(/[，,]/).map((item) => item.trim()).filter(Boolean)
              : value;
          }
        })
      );
    });
  };

  const renderTopics = () => {
    const list = document.querySelector("[data-topic-editors]");
    list.replaceChildren();
    content.topics.forEach((topic) => {
      const card = element("article", "editor-card topic-editor");
      const heading = element("header", "topic-editor-head");
      const index = element("span", "topic-editor-index", topic.number);
      index.style.color = topic.accent;
      const titleGroup = element("div");
      titleGroup.append(element("p", "editor-kicker", topic.note), element("h3", "", topic.title));
      const swatch = element("span", "topic-swatch");
      swatch.style.background = topic.accent;
      heading.append(index, titleGroup, swatch);
      card.append(heading);

      const grid = element("div", "field-grid");
      const definitions = [
        ["短标题", "shortTitle"],
        ["完整标题", "title"],
        ["英文标签", "note"],
        ["品牌色", "accent", "color"],
        ["概览介绍", "description", "textarea", true],
        ["专题大标题（换行保留）", "detailTitle", "textarea", true],
        ["专题导语", "detailIntro", "textarea", true],
        ["专题原则短句", "principle", "textarea", true]
      ];
      definitions.forEach(([label, key, type = "text", wide = false]) => {
        grid.append(
          field({
            label,
            value: topic[key],
            type,
            wide,
            rows: 3,
            onChange: (value) => {
              topic[key] = value;
              if (key === "accent") {
                swatch.style.background = value;
                index.style.color = value;
              }
            }
          })
        );
      });
      card.append(grid);
      list.append(card);
    });
  };

  const updateMetrics = () => {
    document.querySelector("[data-entry-count]").textContent = String(content.entries.length);
    document.querySelector("[data-published-count]").textContent = String(
      content.entries.filter((item) => item.status === "published" && item.href).length
    );
    document.querySelector("[data-coming-count]").textContent = String(
      content.entries.filter((item) => item.status === "comingSoon").length
    );
    document.querySelector("[data-draft-count]").textContent = String(
      content.entries.filter((item) => item.status === "draft").length
    );
  };

  const renderEntries = () => {
    const list = document.querySelector("[data-entry-list]");
    const filterValue = document.querySelector("[data-entry-filter]").value;
    list.replaceChildren();
    const entries = content.entries
      .filter((item) => filterValue === "all" || item.topicId === filterValue)
      .sort((a, b) => a.order - b.order);

    entries.forEach((item) => {
      const card = element("article", "entry-row");
      const index = element("span", "entry-order", String(item.order).padStart(2, "0"));
      const body = element("div", "entry-row-body");
      const meta = element("div", "entry-meta");
      meta.append(
        element("span", `status-pill status-${item.status}`, statusLabels[item.status]),
        element("span", "", topicLabels[item.topicId]),
        element("span", "", kindLabels[item.kind])
      );
      body.append(meta, element("h3", "", item.title), element("p", "", item.summary));
      const linkState = element("span", `link-state ${item.href ? "has-link" : ""}`, item.href ? "链接已配置" : "缺少链接");
      const edit = element("button", "entry-edit", "编辑 →");
      edit.type = "button";
      edit.addEventListener("click", () => openEntryDialog(item.id));
      card.append(index, body, linkState, edit);
      list.append(card);
    });

    if (entries.length === 0) list.append(element("p", "empty-state", "这个专题还没有内容。"));
    updateMetrics();
  };

  const entryDialog = document.querySelector("[data-entry-dialog]");
  const entryForm = document.querySelector("[data-entry-form]");
  const entryFields = document.querySelector("[data-entry-fields]");
  const deleteEntryButton = document.querySelector("[data-delete-entry]");

  const blankEntry = () => ({
    id: `entry-${Date.now()}`,
    topicId: "career",
    kind: "article",
    eyebrow: "NEW CONTENT",
    title: "",
    summary: "",
    href: "",
    cover: "",
    actionLabel: "阅读全文",
    tags: [],
    status: "draft",
    featured: false,
    order: 100
  });

  const openEntryDialog = (id = null) => {
    editingEntryId = id;
    const source = id ? content.entries.find((item) => item.id === id) : blankEntry();
    const draft = structuredClone(source);
    entryDialog._draft = draft;
    document.querySelector("[data-entry-dialog-title]").textContent = id ? "编辑内容" : "新建内容";
    deleteEntryButton.hidden = !id;
    entryFields.replaceChildren();

    const fields = [
      { label: "内容 ID（英文、小写、连字符）", key: "id", wide: true },
      { label: "所属专题", key: "topicId", type: "select", options: Object.entries(topicLabels).map(([value, label]) => ({ value, label })) },
      { label: "内容类型", key: "kind", type: "select", options: Object.entries(kindLabels).map(([value, label]) => ({ value, label })) },
      { label: "状态", key: "status", type: "select", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
      { label: "排序数字", key: "order", type: "number" },
      { label: "设为重点内容", key: "featured", type: "checkbox" },
      { label: "英文眉题", key: "eyebrow" },
      { label: "标题", key: "title", wide: true },
      { label: "摘要", key: "summary", type: "textarea", wide: true, rows: 5 },
      { label: "外部链接", key: "href", wide: true, help: "尚未提供时留空，前台会显示待接入状态。" },
      { label: "封面路径或 URL", key: "cover", wide: true },
      { label: "按钮文案", key: "actionLabel" },
      { label: "标签（逗号分隔）", key: "tags", wide: true }
    ];

    fields.forEach((definition) => {
      const isTags = definition.key === "tags";
      entryFields.append(
        field({
          ...definition,
          value: isTags ? draft.tags.join("，") : draft[definition.key],
          dirtyOnChange: false,
          onChange: (value) => {
            draft[definition.key] = isTags
              ? value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean)
              : value;
          }
        })
      );
    });
    entryDialog.showModal();
  };

  entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = entryDialog._draft;
    if (!draft.title.trim() || !draft.id.match(/^[a-z0-9-]+$/) || !draft.summary.trim()) {
      showToast("请填写有效的 ID、标题和摘要。", "error");
      return;
    }
    const duplicate = content.entries.some((item) => item.id === draft.id && item.id !== editingEntryId);
    if (duplicate) {
      showToast("这个内容 ID 已经存在。", "error");
      return;
    }
    if (editingEntryId) {
      const index = content.entries.findIndex((item) => item.id === editingEntryId);
      content.entries[index] = draft;
    } else {
      content.entries.push(draft);
    }
    markDirty();
    renderEntries();
    entryDialog.close();
  });

  deleteEntryButton.addEventListener("click", () => {
    if (!editingEntryId || !window.confirm("确定删除这条内容吗？保存前仍可通过刷新页面恢复。")) return;
    content.entries = content.entries.filter((item) => item.id !== editingEntryId);
    markDirty();
    renderEntries();
    entryDialog.close();
  });

  document.querySelectorAll("[data-close-entry]").forEach((button) => {
    button.addEventListener("click", () => entryDialog.close());
  });

  const renderChannels = () => {
    const container = document.querySelector("[data-channel-editors]");
    container.replaceChildren();
    content.channels.forEach((channel) => {
      const card = element("article", "editor-card channel-editor");
      const preview = element("div", "channel-qr-preview");
      const image = document.createElement("img");
      image.src = channel.qrImage;
      image.alt = `${channel.platform}二维码预览`;
      preview.append(image);
      const body = element("div", "field-grid");
      [
        ["平台名称", "platform"],
        ["账号名称", "handle"],
        ["入口标题", "title", "text", true],
        ["说明", "description", "textarea", true],
        ["二维码图片路径", "qrImage", "text", true],
        ["可直接访问链接", "href", "text", true]
      ].forEach(([label, key, type = "text", wide = false]) => {
        body.append(
          field({
            label,
            value: channel[key],
            type,
            wide,
            onChange: (value) => {
              channel[key] = value;
              if (key === "qrImage") image.src = value;
            }
          })
        );
      });
      card.append(preview, body);
      container.append(card);
    });
  };

  const renderSettings = () => {
    const form = document.querySelector("[data-settings-form]");
    form.replaceChildren();
    const settings = content.settings;
    form.append(
      field({ label: "公开联系邮箱", value: settings.contactEmail, type: "email", wide: true, onChange: (value) => (settings.contactEmail = value) }),
      field({ label: "页尾短句", value: settings.footerLine, wide: true, onChange: (value) => (settings.footerLine = value) }),
      field({ label: "在公开页脚显示后台入口", value: settings.showAdminLink, type: "checkbox", wide: true, onChange: (value) => (settings.showAdminLink = value) })
    );
  };

  const renderAll = () => {
    renderProfile();
    renderTopics();
    renderEntries();
    renderChannels();
    renderSettings();
    document.querySelector("[data-updated-at]").textContent = new Date(content.updatedAt).toLocaleString("zh-CN");
  };

  const loadContent = async () => {
    try {
      const response = await fetch("/api/admin/content", { headers: { Accept: "application/json" } });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      if (!response.ok) throw new Error("内容加载失败");
      content = await response.json();
      renderAll();
      loading.hidden = true;
    } catch (error) {
      loading.hidden = true;
      errorBox.hidden = false;
      errorBox.textContent = error.message || "内容加载失败，请刷新页面重试。";
    }
  };

  const saveContent = async () => {
    if (!content) return;
    saveButton.disabled = true;
    saveButton.textContent = "正在保存…";
    try {
      const response = await fetch("/api/admin/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify(content)
      });
      const result = await response.json();
      if (!response.ok) {
        const fieldMessage = result.fields?.[0] ? `${result.fields[0].path}: ${result.fields[0].message}` : "";
        throw new Error(`${result.error || "保存失败"}${fieldMessage ? `（${fieldMessage}）` : ""}`);
      }
      content = result.content;
      dirty = false;
      saveStatus.textContent = "所有修改已保存";
      saveStatus.classList.remove("is-dirty");
      document.querySelector("[data-updated-at]").textContent = new Date(content.updatedAt).toLocaleString("zh-CN");
      showToast("内容已保存，刷新公开主页即可看到更新。", "success");
    } catch (error) {
      showToast(error.message || "保存失败，请稍后重试。", "error");
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "保存并更新前台";
    }
  };

  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.panelTarget;
      document.querySelectorAll("[data-panel-target]").forEach((item) => item.classList.toggle("is-active", item === button));
      document.querySelectorAll("[data-panel]").forEach((panel) => panel.classList.toggle("is-active", panel.dataset.panel === target));
      document.querySelector("[data-page-title]").textContent = panelTitles[target];
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  document.querySelectorAll("[data-go-panel]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector(`[data-panel-target="${button.dataset.goPanel}"]`)?.click());
  });

  document.querySelector("[data-entry-filter]").addEventListener("change", renderEntries);
  document.querySelector("[data-new-entry]").addEventListener("click", () => openEntryDialog());
  saveButton.addEventListener("click", saveContent);
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  loadContent();
})();
