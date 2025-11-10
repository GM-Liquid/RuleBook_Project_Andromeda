(function () {
    const STORAGE_KEY = 'custom_toc_state';

    /** Получаем все h1..h6 из контента */
    function getHeadings() {
        const article = document.querySelector('article.md-content__inner, .md-content__inner');
        if (!article) return [];
        const hs = article.querySelectorAll('h1, h2, h3, h4, h5, h6');
        // В оглавлении верхний уровень — ТОЛЬКО H1
        return Array.from(hs).filter(h => h.id);
    }

    /** Строим дерево [{el, level, children}] только с H1 на верхнем уровне */
    function buildTree(headings) {
        const items = headings.map(h => ({
            el: h,
            level: parseInt(h.tagName.substring(1), 10),
            children: []
        }));
        // Фильтруем, оставляя все уровни, но корни — только level===1
        const root = [];
        const stack = [];
        items.forEach(node => {
            while (stack.length && stack[stack.length - 1].level >= node.level) stack.pop();
            if (node.level === 1) {
                root.push(node);
                stack.length = 0;
                stack.push(node);
            } else {
                const parent = stack[stack.length - 1];
                if (parent) parent.children.push(node);
                stack.push(node);
            }
        });
        return root;
    }

    /** Восстановление/сохранение состояния свёрнутости */
    function loadState() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    }
    function saveState(state) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { }
    }

    /** Создаём UL/LI с кнопками-стрелками */
    function renderTree(tree) {
        const state = loadState();

        function makeList(nodes, path) {
            const ul = document.createElement('ul');
            nodes.forEach((node, idx) => {
                const li = document.createElement('li');
                const key = path.concat(idx).join('.');
                const hasChildren = node.children && node.children.length > 0;

                if (hasChildren) {
                    const btn = document.createElement('button');
                    btn.className = 'caret';
                    btn.setAttribute('aria-label', 'Toggle');
                    li.appendChild(btn);
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const collapsed = li.classList.toggle('collapsed');
                        sub.classList.toggle('collapsed', collapsed);
                        state[key] = collapsed ? 1 : 0;
                        saveState(state);
                    });
                } else {
                    // выравниваем текст, если нет кнопки
                    const spacer = document.createElement('span');
                    spacer.style.display = 'inline-block';
                    spacer.style.width = '1rem';
                    spacer.style.marginRight = '.25rem';
                    li.appendChild(spacer);
                }

                const a = document.createElement('a');
                a.href = '#' + node.el.id;
                a.textContent = node.el.textContent.trim();
                li.appendChild(a);

                // Подсписок
                let sub = null;
                if (hasChildren) {
                    sub = makeList(node.children, path.concat(idx));
                    li.appendChild(sub);
                }

                // Восстановить свёрнутость
                const collapsed = !!state[key];
                if (collapsed && hasChildren) {
                    li.classList.add('collapsed');
                    sub.classList.add('collapsed');
                }

                ul.appendChild(li);
            });
            return ul;
        }

        return makeList(tree, []);
    }

    /** Подсветка активного заголовка при прокрутке */
    function attachActiveLink(container) {
        const links = Array.from(container.querySelectorAll('a[href^="#"]'));
        if (!links.length) return;
        const map = new Map(
            links.map(a => [decodeURIComponent(a.getAttribute('href').slice(1)), a])
        );
        const observer = new IntersectionObserver(entries => {
            entries.forEach(e => {
                const id = e.target.id;
                const link = map.get(id);
                if (!link) return;
                if (e.isIntersecting) {
                    links.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        }, { rootMargin: '0px 0px -80% 0px', threshold: [0, 1] });

        map.forEach((_, id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
    }

    /** Вставляем наш ToC в левую колонку */
    function mount() {
        const sidebar = document.querySelector('.md-sidebar--primary .md-sidebar__inner');
        if (!sidebar) return;

        // убираем предыдущий экземпляр
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

        const list = renderTree(tree);
        box.appendChild(list);

        // размещаем ПОД поиском/шапкой
        sidebar.appendChild(box);
        attachActiveLink(box);
    }

    // Первичная отрисовка после загрузки
    document.addEventListener('DOMContentLoaded', mount);

    // Переотрисовка при навигации без перезагрузки (navigation.instant)
    document.addEventListener('navigation', mount);
})();
