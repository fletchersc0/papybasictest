document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE ---
    let savedPaperIds = JSON.parse(localStorage.getItem('paperPinSavedIds')) || [];
    let builderPaperIds = JSON.parse(localStorage.getItem('paperPinBuilderIds')) || []; // Persist builder too
    let allPapersData = [];
    let currentlyDisplayedExplorePapersCount = 0;
    const papersPerLoad = 10; // Adjusted for potentially longer full texts
    let activeTab = 'explore';

    let currentPaperForPassagesId = null;
    let currentPassageTextForRelated = null;

    // --- DOM ELEMENTS ---
    const exploreTabButton = document.getElementById('exploreTabButton');
    const savedTabButton = document.getElementById('savedTabButton');
    const exploreView = document.getElementById('exploreView');
    const savedView = document.getElementById('savedView');

    const exploreFeedColumn = document.getElementById('exploreFeedColumn');
    const explorePassageColumn = document.getElementById('explorePassageColumn');
    const exploreRelatedColumn = document.getElementById('exploreRelatedColumn');

    const savedPapersColumn = document.getElementById('savedPapersColumn');
    const savedBuilderColumn = document.getElementById('savedBuilderColumn');
    const savedSuggestionsColumn = document.getElementById('savedSuggestionsColumn');

    // --- DATA LOADING ---
    async function loadPaperData() {
        try {
            const response = await fetch('papers.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allPapersData = await response.json();
            console.log("Paper data loaded:", allPapersData.length, "papers");
        } catch (error) {
            console.error("Could not load paper data:", error);
            exploreFeedColumn.innerHTML = '<h3>Explore Feed</h3><div class="placeholder">Error loading papers. Please check papers.json and console.</div>';
            allPapersData = [];
        }
    }

    // --- RENDERING FUNCTIONS ---
    function createPaperCard(paper, context) {
        const card = document.createElement('article');
        card.className = 'card paper-card';
        card.dataset.paperId = paper.id;

        const titleEl = document.createElement('h4');
        titleEl.textContent = paper.title;
        card.appendChild(titleEl);

        const authorsEl = document.createElement('p');
        authorsEl.textContent = `Authors: ${paper.authors.join(', ')}`;
        card.appendChild(authorsEl);

        const abstractSnippet = paper.abstract.substring(0, 120) + (paper.abstract.length > 120 ? '...' : '');
        const abstractEl = document.createElement('p');
        abstractEl.textContent = abstractSnippet;
        card.appendChild(abstractEl);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const isSaved = savedPaperIds.includes(paper.id);
        const saveButton = document.createElement('button');
        saveButton.className = 'save-toggle';
        saveButton.textContent = isSaved ? 'Saved' : 'Save';
        if (isSaved) saveButton.classList.add('saved');
        saveButton.onclick = (e) => { e.stopPropagation(); toggleSavePaper(paper.id); };
        actions.appendChild(saveButton);

        // Card click to load passages (Explore Tab related contexts)
        if (context === 'explore-feed' || context === 'explore-related' || context === 'saved-suggestion') {
            card.addEventListener('click', function(event) {
                if (event.target.closest('.actions button')) return; // Ignore clicks on action buttons
                if (activeTab === 'explore') { // Only load passages if in explore tab
                    currentPaperForPassagesId = this.dataset.paperId;
                    currentPassageTextForRelated = null; // Reset related when new paper is main focus
                    refreshAll();
                } else if (activeTab === 'saved' && context === 'saved-suggestion') {
                    // If a suggestion is clicked in saved tab, switch to explore and show it
                    switchTab('explore', this.dataset.paperId);
                }
            });
        }

        if (context === 'saved-list') {
            const addButton = document.createElement('button');
            addButton.className = 'add-to-builder';
            addButton.textContent = 'Add →';
            addButton.onclick = (e) => { e.stopPropagation(); addPaperToBuilder(paper.id); };
            actions.appendChild(addButton);
        }

        if (context === 'builder-list') {
            const upButton = document.createElement('button');
            upButton.className = 'reorder-up';
            upButton.textContent = '↑';
            upButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(paper.id, -1); };
            actions.appendChild(upButton);

            const downButton = document.createElement('button');
            downButton.className = 'reorder-down';
            downButton.textContent = '↓';
            downButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(paper.id, 1); };
            actions.appendChild(downButton);

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-from-builder';
            removeButton.textContent = '×';
            removeButton.onclick = (e) => { e.stopPropagation(); removePaperFromBuilder(paper.id); };
            actions.appendChild(removeButton);
        }
        card.appendChild(actions);
        return card;
    }

    function renderColumn(columnElement, title, items, cardCreatorFn, context, placeholderText) {
        columnElement.innerHTML = `<h3>${title}</h3>`;
        if (!items || items.length === 0) {
            columnElement.innerHTML += `<div class="placeholder">${placeholderText}</div>`;
            return;
        }
        items.forEach(item => columnElement.appendChild(cardCreatorFn(item, context)));
    }

    function renderExploreFeed() {
        const feedContainer = exploreFeedColumn; // Direct reference
        feedContainer.innerHTML = '<h3>Explore Feed</h3>'; // Clear previous, keep header

        if (!allPapersData || allPapersData.length === 0) {
             feedContainer.innerHTML += '<div class="placeholder">No papers loaded. Check papers.json.</div>'; return;
        }
        const papersToDisplay = allPapersData.slice(0, currentlyDisplayedExplorePapersCount);
        if (papersToDisplay.length === 0) {
             feedContainer.innerHTML += '<div class="placeholder">No papers to display.</div>'; return;
        }
        papersToDisplay.forEach(paper => feedContainer.appendChild(createPaperCard(paper, 'explore-feed')));

        if (currentlyDisplayedExplorePapersCount < allPapersData.length) {
            const loadMorePlaceholder = document.createElement('div');
            loadMorePlaceholder.className = 'placeholder';
            loadMorePlaceholder.textContent = 'Scroll to load more...';
            feedContainer.appendChild(loadMorePlaceholder);
        } else if (allPapersData.length > 0) {
            const allLoadedPlaceholder = document.createElement('div');
            allLoadedPlaceholder.className = 'placeholder';
            allLoadedPlaceholder.textContent = 'All papers loaded.';
            feedContainer.appendChild(allLoadedPlaceholder);
        }
    }

    function renderPassages() {
        explorePassageColumn.innerHTML = '<h3>Paper Passages</h3>';
        if (!currentPaperForPassagesId) {
            explorePassageColumn.innerHTML += '<div class="placeholder">Click a paper on the left to see its passages.</div>'; return;
        }
        const paper = allPapersData.find(p => p.id === currentPaperForPassagesId);
        if (!paper) {
            explorePassageColumn.innerHTML += `<div class="placeholder">Paper (ID: ${currentPaperForPassagesId}) not found.</div>`; return;
        }
        const textToSplit = paper.fullText || paper.abstract || "";
        const sentences = textToSplit.match(/[^.!?]+[.!?]+/g) || (textToSplit.trim() ? [textToSplit.trim()] : []);

        if (sentences.length === 0) {
            explorePassageColumn.innerHTML += '<div class="placeholder">No passages found in this paper\'s text.</div>'; return;
        }
        sentences.forEach(sentence => {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) return;
            const passageCard = document.createElement('article');
            passageCard.className = 'card passage-card';
            passageCard.textContent = trimmedSentence;
            passageCard.onclick = () => { currentPassageTextForRelated = trimmedSentence; refreshAll(); };
            explorePassageColumn.appendChild(passageCard);
        });
    }

    function getRelevantPapers(baseKeywords, excludeIds, count) {
        const candidates = allPapersData.filter(p => !excludeIds.includes(p.id));
        if (candidates.length === 0) return [];

        const scoredPapers = candidates.map(paper => {
            let score = 0;
            const paperText = `${paper.title} ${paper.abstract} ${(paper.keywords || []).join(" ")}`.toLowerCase();
            baseKeywords.forEach(kw => {
                if (paperText.includes(kw.toLowerCase())) score++;
            });
            // Bonus for direct keyword matches
            (paper.keywords || []).forEach(pk => {
                if (baseKeywords.some(bk => pk.toLowerCase().includes(bk.toLowerCase()))) score += 2;
            });
            return { paper, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

        let results = scoredPapers.map(item => item.paper);
        
        // Fill with random if not enough scored results
        if (results.length < count) {
            const currentResultIds = results.map(r => r.id);
            const randomFill = candidates.filter(p => !currentResultIds.includes(p.id));
            let i = 0;
            while(results.length < count && i < randomFill.length) {
                results.push(randomFill[i]);
                i++;
            }
        }
        return results.slice(0, count);
    }

    function renderRelatedPapers() {
        exploreRelatedColumn.innerHTML = '<h3>Related Papers</h3>';
        if (!currentPassageTextForRelated) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">Click a passage to see related papers.</div>'; return;
        }
        const passageKeywords = currentPassageTextForRelated.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0, 5);
        const relatedPapers = getRelevantPapers(passageKeywords, [currentPaperForPassagesId], 10);
        renderColumn(exploreRelatedColumn, 'Related Papers', relatedPapers, createPaperCard, 'explore-related', 'No related papers found for this passage.');
    }

    function renderSavedPapersList() {
        const papers = savedPaperIds.map(id => allPapersData.find(p => p.id === id)).filter(Boolean);
        renderColumn(savedPapersColumn, 'Saved Papers', papers, createPaperCard, 'saved-list', 'No papers saved yet.');
    }

    function renderBuilderList() {
        const papers = builderPaperIds.map(id => allPapersData.find(p => p.id === id)).filter(Boolean);
        renderColumn(savedBuilderColumn, 'Builder', papers, createPaperCard, 'builder-list', 'Add papers from your saved list.');
        renderLiveSuggestions(); // Update suggestions when builder changes
    }

    function renderLiveSuggestions() {
        savedSuggestionsColumn.innerHTML = '<h3>Live Suggestions</h3>';
        let suggestionKeywords = [];
        if (builderPaperIds.length > 0) {
            const lastBuilderPaperId = builderPaperIds[builderPaperIds.length - 1];
            const lastPaper = allPapersData.find(p => p.id === lastBuilderPaperId);
            if (lastPaper) {
                suggestionKeywords.push(...(lastPaper.keywords || []));
                suggestionKeywords.push(...lastPaper.title.toLowerCase().split(/\s+/).filter(kw => kw.length > 3));
            }
        } else { // If builder is empty, maybe use current passage if in explore?
             if (activeTab === 'explore' && currentPassageTextForRelated) {
                 suggestionKeywords = currentPassageTextForRelated.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0,5);
             } else {
                savedSuggestionsColumn.innerHTML += '<div class="placeholder">Add to builder or explore passages for suggestions.</div>'; return;
             }
        }
        if(suggestionKeywords.length === 0) {
             savedSuggestionsColumn.innerHTML += '<div class="placeholder">Not enough context for suggestions.</div>'; return;
        }

        const excludeIds = [...savedPaperIds, ...builderPaperIds, currentPaperForPassagesId].filter(Boolean);
        const suggestedPapers = getRelevantPapers([...new Set(suggestionKeywords)], excludeIds, 5);
        renderColumn(savedSuggestionsColumn, 'Live Suggestions', suggestedPapers, createPaperCard, 'saved-suggestion', 'No new suggestions found.');
    }

    // --- STATE MUTATION & ACTIONS ---
    function updateLocalStorage() {
        localStorage.setItem('paperPinSavedIds', JSON.stringify(savedPaperIds));
        localStorage.setItem('paperPinBuilderIds', JSON.stringify(builderPaperIds));
    }

    function toggleSavePaper(paperId) {
        const index = savedPaperIds.indexOf(paperId);
        if (index > -1) {
            savedPaperIds.splice(index, 1);
            const builderIndex = builderPaperIds.indexOf(paperId); // Also remove from builder if unsaved
            if (builderIndex > -1) builderPaperIds.splice(builderIndex, 1);
        } else {
            savedPaperIds.push(paperId);
        }
        updateLocalStorage();
        refreshAll();
    }

    function addPaperToBuilder(paperId) {
        if (!builderPaperIds.includes(paperId)) {
            builderPaperIds.push(paperId);
            updateLocalStorage();
            refreshAll();
        }
    }

    function removePaperFromBuilder(paperId) {
        const index = builderPaperIds.indexOf(paperId);
        if (index > -1) {
            builderPaperIds.splice(index, 1);
            updateLocalStorage();
            refreshAll();
        }
    }

    function moveBuilderItem(paperId, direction) {
        const index = builderPaperIds.indexOf(paperId);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= builderPaperIds.length) return;
        [builderPaperIds[index], builderPaperIds[newIndex]] = [builderPaperIds[newIndex], builderPaperIds[index]]; // Swap
        updateLocalStorage();
        refreshAll();
    }

    function loadMoreExplorePapers() {
        if (currentlyDisplayedExplorePapersCount >= allPapersData.length) return;
        currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, currentlyDisplayedExplorePapersCount + papersPerLoad);
        renderExploreFeed(); // Only re-render the feed
    }

    // --- TAB SWITCHING ---
    function switchTab(tabName, initialPaperIdForExplore = null) {
        activeTab = tabName;
        exploreView.style.display = (tabName === 'explore') ? 'flex' : 'none';
        savedView.style.display = (tabName === 'saved') ? 'flex' : 'none';
        exploreTabButton.classList.toggle('active', tabName === 'explore');
        savedTabButton.classList.toggle('active', tabName === 'saved');

        currentPassageTextForRelated = null; // Reset context
        if (tabName === 'explore' && initialPaperIdForExplore) {
            currentPaperForPassagesId = initialPaperIdForExplore;
        } else {
            currentPaperForPassagesId = null;
        }
        refreshAll();
    }

    // --- `refreshAll()` ---
    function refreshAll() {
        if (activeTab === 'explore') {
            renderExploreFeed();
            renderPassages();
            renderRelatedPapers();
        } else { // 'saved'
            renderSavedPapersList();
            renderBuilderList(); // Includes call to renderLiveSuggestions
        }
    }

    // --- EVENT LISTENERS ---
    exploreTabButton.onclick = () => switchTab('explore');
    savedTabButton.onclick = () => switchTab('saved');

    exploreFeedColumn.addEventListener('scroll', () => {
        if (activeTab === 'explore' && exploreFeedColumn.scrollTop + exploreFeedColumn.clientHeight >= exploreFeedColumn.scrollHeight - 150) {
            if (currentlyDisplayedExplorePapersCount < allPapersData.length) {
                loadMoreExplorePapers();
            }
        }
    });

    // --- INITIALIZATION ---
    async function initializeApp() {
        await loadPaperData();
        if (allPapersData && allPapersData.length > 0) {
            currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, papersPerLoad);
        }
        switchTab('explore'); // Default to explore tab
    }

    initializeApp();
});
