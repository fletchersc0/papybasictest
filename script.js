document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE ---
    let savedItems = JSON.parse(localStorage.getItem('paperPinSavedItems_v2')) || []; // Added _v2 to ensure fresh start if old structure existed
    let builderItems = JSON.parse(localStorage.getItem('paperPinBuilderItems_v2')) || []; // Added _v2
    let allPapersData = [];
    let currentlyDisplayedExplorePapersCount = 0;
    const papersPerLoad = 10;
    let activeTab = 'explore';

    let currentPaperForPassagesId = null;
    let currentPassageTextForRelated = null;

    // --- DOM ELEMENTS --- (Same)
    const exploreTabButton = document.getElementById('exploreTabButton');
    const savedTabButton = document.getElementById('savedTabButton');
    const exploreView = document.getElementById('exploreView');
    const savedView = document.getElementById('savedView');

    const exploreFeedColumn = document.getElementById('exploreFeedColumn');
    const explorePassageColumn = document.getElementById('explorePassageColumn');
    const exploreRelatedColumn = document.getElementById('exploreRelatedColumn');

    const savedItemsColumn = document.getElementById('savedPapersColumn'); // Keeping ID, changing purpose
    const savedBuilderColumn = document.getElementById('savedBuilderColumn');
    const savedSuggestionsColumn = document.getElementById('savedSuggestionsColumn');

    // --- UTILITY FUNCTIONS ---
    function isItemEqual(item1, item2) {
        if (!item1 || !item2 || item1.type !== item2.type) return false;
        if (item1.type === 'paper') {
            return item1.paperId === item2.paperId;
        }
        if (item1.type === 'passage') {
            // Ensure both paperId and passageText are defined for comparison
            return item1.paperId && item2.paperId && item1.passageText && item2.passageText &&
                   item1.paperId === item2.paperId && item1.passageText === item2.passageText;
        }
        return false;
    }

    function findItemIndex(itemList, itemToFind) {
        for (let i = 0; i < itemList.length; i++) {
            if (isItemEqual(itemList[i], itemToFind)) {
                return i;
            }
        }
        return -1;
    }

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
    function createPaperCard(paper, context) { // itemType argument removed, always 'paper' for this card
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

        const paperItemToSave = { type: 'paper', paperId: paper.id }; // Define the item structure
        const isSaved = findItemIndex(savedItems, paperItemToSave) !== -1;

        const saveButton = document.createElement('button');
        saveButton.className = 'save-toggle';
        saveButton.textContent = isSaved ? 'Unsave Paper' : 'Save Paper'; // Clarified text
        if (isSaved) saveButton.classList.add('saved');
        saveButton.onclick = (e) => { e.stopPropagation(); console.log('Paper card save clicked:', paperItemToSave); toggleSaveItem(paperItemToSave); };
        actions.appendChild(saveButton);

        if (context === 'explore-feed' || context === 'explore-related' || context === 'saved-suggestion') {
            card.addEventListener('click', function(event) {
                if (event.target.closest('.actions button')) return;
                if (activeTab === 'explore') {
                    currentPaperForPassagesId = this.dataset.paperId;
                    currentPassageTextForRelated = null;
                    refreshAll();
                } else if (activeTab === 'saved' && context === 'saved-suggestion') {
                    switchTab('explore', this.dataset.paperId);
                }
            });
        }

        if (context === 'saved-list') { // This means it's a full paper in the saved items list
            const addButton = document.createElement('button');
            addButton.className = 'add-to-builder';
            addButton.textContent = 'Add Paper →';
            addButton.onclick = (e) => { e.stopPropagation(); addItemToBuilder(paperItemToSave); };
            actions.appendChild(addButton);
            // The main saveButton above acts as "Unsave Paper"
        }
        
        if (context === 'builder-list') { // This means it's a full paper in the builder
            const upButton = document.createElement('button');
            upButton.className = 'reorder-up';
            upButton.textContent = '↑';
            upButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(paperItemToSave, -1); };
            actions.appendChild(upButton);

            const downButton = document.createElement('button');
            downButton.className = 'reorder-down';
            downButton.textContent = '↓';
            downButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(paperItemToSave, 1); };
            actions.appendChild(downButton);

            const removeBuilderButton = document.createElement('button');
            removeBuilderButton.className = 'remove-from-builder';
            removeBuilderButton.textContent = '× From Builder';
            removeBuilderButton.onclick = (e) => { e.stopPropagation(); removeItemFromBuilder(paperItemToSave); };
            actions.appendChild(removeBuilderButton);
            // The main saveButton keeps its "Unsave Paper" (from global savedItems) functionality
        }
        card.appendChild(actions);
        return card;
    }

    function createPassageSnippetCard(passageItem, context) {
        const card = document.createElement('article');
        card.className = 'card passage-snippet-card';
        
        const passageTextEl = document.createElement('p');
        passageTextEl.textContent = `"${passageItem.passageText}"`;
        passageTextEl.style.fontStyle = 'italic';
        passageTextEl.style.marginBottom = '8px';
        card.appendChild(passageTextEl);

        const sourcePaper = allPapersData.find(p => p.id === passageItem.paperId);
        if (sourcePaper) {
            const sourceInfo = document.createElement('p');
            sourceInfo.textContent = `(From: ${sourcePaper.title.substring(0,50)}...)`;
            sourceInfo.style.fontSize = '0.85em';
            sourceInfo.style.color = '#586069';
            card.appendChild(sourceInfo);
        }

        const actions = document.createElement('div');
        actions.className = 'actions';

        const isSaved = findItemIndex(savedItems, passageItem) !== -1;
        const saveOrUnsaveButton = document.createElement('button');
        saveOrUnsaveButton.className = 'save-toggle';
        saveOrUnsaveButton.textContent = isSaved ? 'Unsave Passage' : 'Save Passage'; // This should mostly be "Unsave" if it's in saved-list
        if (isSaved) saveOrUnsaveButton.classList.add('saved');
        saveOrUnsaveButton.onclick = (e) => { e.stopPropagation(); console.log('Passage snippet save/unsave clicked:', passageItem); toggleSaveItem(passageItem); };
        actions.appendChild(saveOrUnsaveButton);

        if (context === 'saved-list') {
            const addButton = document.createElement('button');
            addButton.className = 'add-to-builder';
            addButton.textContent = 'Add Passage →';
            addButton.onclick = (e) => { e.stopPropagation(); addItemToBuilder(passageItem); };
            actions.appendChild(addButton);
        }

        if (context === 'builder-list') {
            const upButton = document.createElement('button');
            upButton.className = 'reorder-up';
            upButton.textContent = '↑';
            upButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(passageItem, -1); };
            actions.appendChild(upButton);

            const downButton = document.createElement('button');
            downButton.className = 'reorder-down';
            downButton.textContent = '↓';
            downButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(passageItem, 1); };
            actions.appendChild(downButton);

            const removeBuilderButton = document.createElement('button');
            removeBuilderButton.className = 'remove-from-builder';
            removeBuilderButton.textContent = '× From Builder';
            removeBuilderButton.onclick = (e) => { e.stopPropagation(); removeItemFromBuilder(passageItem); };
            actions.appendChild(removeBuilderButton);
        }
        card.appendChild(actions);
        return card;
    }

    function renderExploreFeed() {
        const feedContainer = exploreFeedColumn;
        feedContainer.innerHTML = '<h3>Explore Feed</h3>';
        if (!allPapersData || allPapersData.length === 0) {
             feedContainer.innerHTML += '<div class="placeholder">No papers loaded.</div>'; return;
        }
        const papersToDisplay = allPapersData.slice(0, currentlyDisplayedExplorePapersCount);
        if (papersToDisplay.length === 0 && allPapersData.length > 0) {
             feedContainer.innerHTML += '<div class="placeholder">Loading...</div>'; return;
        }
        if (papersToDisplay.length === 0) {
             feedContainer.innerHTML += '<div class="placeholder">No papers to display.</div>'; return;
        }
        papersToDisplay.forEach(paper => feedContainer.appendChild(createPaperCard(paper, 'explore-feed')));
        if (currentlyDisplayedExplorePapersCount < allPapersData.length) {
            feedContainer.innerHTML += '<div class="placeholder">Scroll to load more...</div>';
        } else if (allPapersData.length > 0) {
            feedContainer.innerHTML += '<div class="placeholder">All papers loaded.</div>';
        }
    }

    function renderPassages() {
        explorePassageColumn.innerHTML = '<h3>Paper Passages</h3>';
        if (!currentPaperForPassagesId) {
            explorePassageColumn.innerHTML += '<div class="placeholder">Click a paper on the left.</div>'; return;
        }
        const paper = allPapersData.find(p => p.id === currentPaperForPassagesId);
        if (!paper) {
            explorePassageColumn.innerHTML += `<div class="placeholder">Paper not found.</div>`; return;
        }
        const textToSplit = paper.fullText || paper.abstract || "";
        const sentences = textToSplit.match(/[^.!?]+[.!?]+/g) || (textToSplit.trim() ? [textToSplit.trim()] : []);
        if (sentences.length === 0) {
            explorePassageColumn.innerHTML += '<div class="placeholder">No passages in text.</div>'; return;
        }
        sentences.forEach(sentence => {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) return;
            const passageCard = document.createElement('article');
            passageCard.className = 'card passage-card';
            const passageTextEl = document.createElement('p');
            passageTextEl.textContent = trimmedSentence;
            passageTextEl.style.marginBottom = '10px';
            passageCard.appendChild(passageTextEl);
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';
            const passageItemToSave = { type: 'passage', paperId: paper.id, passageText: trimmedSentence };
            const isPassageSaved = findItemIndex(savedItems, passageItemToSave) !== -1;
            const savePassageButton = document.createElement('button');
            savePassageButton.className = 'save-toggle';
            savePassageButton.textContent = isPassageSaved ? 'Unsave Passage' : 'Save Passage';
            if (isPassageSaved) savePassageButton.classList.add('saved');
            savePassageButton.onclick = (e) => { e.stopPropagation(); console.log('Passage card save clicked:', passageItemToSave); toggleSaveItem(passageItemToSave); };
            actionsDiv.appendChild(savePassageButton);
            passageCard.appendChild(actionsDiv);
            passageCard.addEventListener('click', function(event) {
                if (event.target.closest('.actions button')) return;
                 currentPassageTextForRelated = trimmedSentence;
                 refreshAll();
            });
            explorePassageColumn.appendChild(passageCard);
        });
    }

    function renderRelatedPapers() {
        exploreRelatedColumn.innerHTML = '<h3>Related Papers</h3>';
        if (!currentPassageTextForRelated) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">Click a passage for related papers.</div>'; return;
        }
        const passageKeywords = currentPassageTextForRelated.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0, 5);
        const relatedPapers = getRelevantPapers(passageKeywords, [currentPaperForPassagesId], 10);
        if(relatedPapers.length === 0) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">No related papers found.</div>';
        } else {
            relatedPapers.forEach(paper => exploreRelatedColumn.appendChild(createPaperCard(paper, 'explore-related')));
        }
    }
    
    function getRelevantPapers(baseKeywords, excludePaperIds, count) {
        const candidates = allPapersData.filter(p => !excludePaperIds.includes(p.id));
        if (candidates.length === 0) return [];
        const scoredPapers = candidates.map(paper => {
            let score = 0;
            const paperText = `${paper.title} ${paper.abstract} ${(paper.keywords || []).join(" ")}`.toLowerCase();
            baseKeywords.forEach(kw => { if (paperText.includes(kw.toLowerCase())) score++; });
            (paper.keywords || []).forEach(pk => { if (baseKeywords.some(bk => pk.toLowerCase().includes(bk.toLowerCase()))) score += 2; });
            return { paper, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
        let results = scoredPapers.map(item => item.paper);
        if (results.length < count) {
            const currentResultIds = results.map(r => r.id);
            const randomFill = candidates.filter(p => !currentResultIds.includes(p.id));
            let i = 0;
            while(results.length < count && i < randomFill.length) { results.push(randomFill[i++]); }
        }
        return results.slice(0, count);
    }

    function renderSavedItemsList() {
        savedItemsColumn.innerHTML = '<h3>Saved Items</h3>';
        console.log("Rendering saved items:", JSON.parse(JSON.stringify(savedItems)));
        if (savedItems.length === 0) {
            savedItemsColumn.innerHTML += '<div class="placeholder">No items saved yet.</div>'; return;
        }
        savedItems.forEach(item => {
            if (item.type === 'paper') {
                const paperData = allPapersData.find(p => p.id === item.paperId);
                if (paperData) {
                    savedItemsColumn.appendChild(createPaperCard(paperData, 'saved-list'));
                } else { console.warn("Saved paper data not found for ID:", item.paperId); }
            } else if (item.type === 'passage') {
                savedItemsColumn.appendChild(createPassageSnippetCard(item, 'saved-list'));
            }
        });
    }

    function renderBuilderList() {
        savedBuilderColumn.innerHTML = '<h3>Builder</h3>';
        console.log("Rendering builder items:", JSON.parse(JSON.stringify(builderItems)));
        if (builderItems.length === 0) {
            savedBuilderColumn.innerHTML += '<div class="placeholder">Add items from your saved list.</div>';
            renderLiveSuggestions(); return;
        }
        builderItems.forEach(item => {
            if (item.type === 'paper') {
                const paperData = allPapersData.find(p => p.id === item.paperId);
                if (paperData) {
                    savedBuilderColumn.appendChild(createPaperCard(paperData, 'builder-list'));
                } else { console.warn("Builder paper data not found for ID:", item.paperId); }
            } else if (item.type === 'passage') {
                savedBuilderColumn.appendChild(createPassageSnippetCard(item, 'builder-list'));
            }
        });
        renderLiveSuggestions();
    }

    function renderLiveSuggestions() {
        savedSuggestionsColumn.innerHTML = '<h3>Live Suggestions</h3>';
        let suggestionKeywords = [];
        let contextItem = null;
        if (builderItems.length > 0) contextItem = builderItems[builderItems.length - 1];
        else if (activeTab === 'explore' && currentPassageTextForRelated) {
             const sourcePaper = allPapersData.find(p => p.id === currentPaperForPassagesId);
             if(sourcePaper) contextItem = { type: 'passage', paperId: currentPaperForPassagesId, passageText: currentPassageTextForRelated, sourceTitle: sourcePaper.title };
        }
        if (contextItem) {
            if (contextItem.type === 'paper') {
                const paper = allPapersData.find(p => p.id === contextItem.paperId);
                if (paper) { suggestionKeywords.push(...(paper.keywords || []), ...paper.title.toLowerCase().split(/\s+/).filter(kw => kw.length > 3));}
            } else if (contextItem.type === 'passage') {
                suggestionKeywords.push(...contextItem.passageText.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0,5));
                 if(contextItem.sourceTitle) suggestionKeywords.push(...contextItem.sourceTitle.toLowerCase().split(/\s+/).filter(kw => kw.length > 3));
            }
        }
        if (suggestionKeywords.length === 0) { savedSuggestionsColumn.innerHTML += '<div class="placeholder">Not enough context.</div>'; return; }
        const excludePaperIds = [...new Set(savedItems.map(i => i.paperId)), ...new Set(builderItems.map(i => i.paperId))];
        if (currentPaperForPassagesId) excludePaperIds.push(currentPaperForPassagesId);
        const suggestedPapers = getRelevantPapers([...new Set(suggestionKeywords)], [...new Set(excludePaperIds)], 5);
        if(suggestedPapers.length === 0) { savedSuggestionsColumn.innerHTML += '<div class="placeholder">No new suggestions.</div>'; }
        else { suggestedPapers.forEach(paper => savedSuggestionsColumn.appendChild(createPaperCard(paper, 'saved-suggestion'))); }
    }

    // --- STATE MUTATION & ACTIONS ---
    function updateLocalStorage() {
        localStorage.setItem('paperPinSavedItems_v2', JSON.stringify(savedItems));
        localStorage.setItem('paperPinBuilderItems_v2', JSON.stringify(builderItems));
        console.log("LocalStorage updated. Saved:", savedItems.length, "Builder:", builderItems.length);
    }

    function toggleSaveItem(itemToToggle) {
        console.log("Toggling save for item:", itemToToggle);
        const index = findItemIndex(savedItems, itemToToggle);
        if (index > -1) {
            console.log("Item found in savedItems, removing.");
            savedItems.splice(index, 1);
            const builderIndex = findItemIndex(builderItems, itemToToggle); // Also remove from builder if unsaving
            if (builderIndex > -1) {
                console.log("Item also found in builderItems, removing.");
                builderItems.splice(builderIndex, 1);
            }
        } else {
            console.log("Item not found in savedItems, adding.");
            savedItems.push(itemToToggle);
        }
        updateLocalStorage();
        refreshAll();
    }

    function addItemToBuilder(itemToAdd) {
        console.log("Adding to builder:", itemToAdd);
        if (findItemIndex(builderItems, itemToAdd) === -1) {
            builderItems.push(itemToAdd);
            updateLocalStorage();
            refreshAll();
        } else { console.log("Item already in builder."); }
    }

    function removeItemFromBuilder(itemToRemove) {
        console.log("Removing from builder:", itemToRemove);
        const index = findItemIndex(builderItems, itemToRemove);
        if (index > -1) {
            builderItems.splice(index, 1);
            updateLocalStorage();
            refreshAll();
        } else { console.log("Item not found in builder to remove.");}
    }

    function moveBuilderItem(itemToMove, direction) {
        console.log("Moving in builder:", itemToMove, "Direction:", direction);
        const index = findItemIndex(builderItems, itemToMove);
        if (index === -1) { console.log("Item not found in builder to move."); return; }
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= builderItems.length) { console.log("Move out of bounds."); return; }
        [builderItems[index], builderItems[newIndex]] = [builderItems[newIndex], builderItems[index]];
        updateLocalStorage();
        refreshAll();
    }

    function loadMoreExplorePapers() {
        if (currentlyDisplayedExplorePapersCount >= allPapersData.length) return;
        currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, currentlyDisplayedExplorePapersCount + papersPerLoad);
        renderExploreFeed();
    }

    // --- TAB SWITCHING ---
    function switchTab(tabName, initialPaperIdForExplore = null) {
        activeTab = tabName;
        exploreView.style.display = (tabName === 'explore') ? 'flex' : 'none';
        savedView.style.display = (tabName === 'saved') ? 'flex' : 'none';
        exploreTabButton.classList.toggle('active', tabName === 'explore');
        savedTabButton.classList.toggle('active', tabName === 'saved');
        currentPassageTextForRelated = null;
        currentPaperForPassagesId = (tabName === 'explore' && initialPaperIdForExplore) ? initialPaperIdForExplore : null;
        refreshAll();
    }

    // --- `refreshAll()` ---
    function refreshAll() {
        console.log(`--- refreshAll (${activeTab}) ---`);
        if (activeTab === 'explore') {
            renderExploreFeed();
            renderPassages();
            renderRelatedPapers();
        } else {
            renderSavedItemsList();
            renderBuilderList();
        }
    }

    // --- EVENT LISTENERS ---
    exploreTabButton.onclick = () => switchTab('explore');
    savedTabButton.onclick = () => switchTab('saved');
    exploreFeedColumn.addEventListener('scroll', () => {
        if (activeTab === 'explore' && exploreFeedColumn.scrollTop + exploreFeedColumn.clientHeight >= exploreFeedColumn.scrollHeight - 150) {
            if (currentlyDisplayedExplorePapersCount < allPapersData.length) loadMoreExplorePapers();
        }
    });

    // --- INITIALIZATION ---
    async function initializeApp() {
        console.log("Initializing app v2...");
        await loadPaperData();
        if (allPapersData && allPapersData.length > 0) {
            currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, papersPerLoad);
        }
        // Attempt to clear old localStorage if structure changed significantly (optional)
        // localStorage.removeItem('paperPinSavedItems'); 
        // localStorage.removeItem('paperPinBuilderItems');
        switchTab('explore');
        console.log("App v2 initialized. Saved items:", savedItems.length, "Builder items:", builderItems.length);
    }

    initializeApp();
});
