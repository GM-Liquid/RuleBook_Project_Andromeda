(function () {
    const STORAGE_PREFIX = 'custom_toc_state:';
    const storageKey = () => STORAGE_PREFIX + (location.pathname || '/');

    // Заголовки только из области статьи
    function getHeadings() {
        const article = document.querySelector('article.md-content__inner, .md-content__inner');
        if (!article) return [];
        return Array.from(article.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(h => h.id);
    }

    // Текст заголовка без ссылки-пермалинка
    function headingText(h) {
        const copy = h.cloneNode(true);
        copy.querySelectorAll('a, .headerlink').forEach(n => n.remove());
        return (copy.textContent || '').trim();
    }

    // Дерево [{el, level, children}] c корнями только из H1
    function buildTree(headings) {
        const items = headings.map(h => ({ el: h, level: +h.tagName.slice(1), children: [] }));
        const root = [];
        const stack = [];
        for (const node of items) {
            while (stack.length && stack.at(-1).level >= node.level) stack.pop();
            if (node.level === 1) {
                root.push(node);
                stack.length = 0;
                stack.push(node);
            } else {
                const parent = stack.at(-1);
                if (parent) parent.children.push(node);
                stack.push(node);
            }
        }
        return root;
    }

    function loadState() {
        try { return JSON.parse(localStorage.getItem(storageKey()) || '{}'); } catch { return {}; }
    }
    function saveState(s) {
        try { localStorage.setItem(storageKey(), JSON.stringify(s)); } catch { }
    }

    // Рендер списка с кнопками свёртки
    function renderTree(tree) {
        const state = loadState();

        function makeList(nodes, path) {
            const ul = document.createElement('ul');

            nodes.forEach((node, idx) => {
                const li = document.createElement('li');
                const key = path.concat(idx).join('.');
                const hasChildren = node.children && node.children.length > 0;

                // Кнопка-стрелка (или пустой отступ, если детей нет)
                let btn = null;
                if (hasChildren) {
                    btn = document.createElement('button');
                    btn.className = 'caret';
                    btn.setAttribute('aria-label', 'Toggle');
                    li.appendChild(btn);
                } else {
                    const spacer = document.createElement('span');
                    spacer.style.display = 'inline-block';
                    spacer.style.width = '1rem';
                    spacer.style.marginRight = '.25rem';
                    li.appendChild(spacer);
                }

                const a = document.createElement('a');
                a.href = '#' + node.el.id;
                a.textContent = headingText(node.el);
                li.appendChild(a);

                let sub = null;
                if (hasChildren) {
                    sub = makeList(node.children, path.concat(idx));
                    li.appendChild(sub);
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const collapsed = li.classList.toggle('collapsed');
                        sub.classList.toggle('collapsed', collapsed);
                        state[key] = collapsed ? 1 : 0;
                        saveState(state);
                    });
                }

                if (state[key] && hasChildren) {
                    li.classList.add('collapsed');
                    sub.classList.add('collapsed');
                }

                ul.appendChild(li);
            });

            return ul;
        }

        return makeList(tree, []);
    }

    // Подсветка активного пункта при прокрутке
    function attachActiveLink(container) {
        const links = Array.from(container.querySelectorAll('a[href^="#"]'));
        if (!links.length) return;

        const map = new Map(links.map(a => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => {
                const link = map.get(e.target.id);
                if (!link) return;
                if (e.isIntersecting) {
                    links.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        }, { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] });

        map.forEach((_, id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
    }

    // Вставка оглавления в левую колонку
    function mount() {
        const sidebar = document.querySelector('.md-sidebar--primary .md-sidebar__inner');
        if (!sidebar) return;

        const old = sidebar.querySelector('#custom-toc');
        if (old) old.remove();

        const headings = getHeadings();
        if (!headings.length) return;

        const tree = buildTree(headings);

        const box = document.createElement('div');
        box.id = 'custom-toc';

        const title = document.createElement('div');
        title.className = 'toc-title';
        title.textContent = 'Содержание';
        box.appendChild(title);

        box.appendChild(renderTree(tree));
        sidebar.appendChild(box);
        attachActiveLink(box);
    }

    // 1) Первая загрузка
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        mount();
    }

    // 2) Любая внутренняя навигация при включённом navigation.instant
    if (window.document$) {
        document$.subscribe(mount);   // <-- ключ к проблеме исчезновения
    }
})();
