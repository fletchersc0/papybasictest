document.addEventListener('DOMContentLoaded', async () => {
    // --- STATE ---
    let savedItems = JSON.parse(localStorage.getItem('paperPinSavedItems')) || []; // New structure
    let builderItems = JSON.parse(localStorage.getItem('paperPinBuilderItems')) || []; // New structure
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

    const savedPapersColumn = document.getElementById('savedPapersColumn'); // Will now be savedItemsColumn
    const savedBuilderColumn = document.getElementById('savedBuilderColumn');
    const savedSuggestionsColumn = document.getElementById('savedSuggestionsColumn');

    // --- UTILITY FUNCTIONS ---
    function isItemEqual(item1, item2) {
        if (!item1 || !item2 || item1.type !== item2.type) return false;
        if (item1.type === 'paper') {
            return item1.paperId === item2.paperId;
        }
        if (item1.type === 'passage') {
            return item1.paperId === item2.paperId && item1.passageText === item2.passageText;
        }
        return false;
    }

    function findItemIndex(itemList, itemToFind) {
        return itemList.findIndex(item => isItemEqual(item, itemToFind));
    }

    // --- DATA LOADING --- (Same)
    async function loadPaperData() {
        try {
            const response = await fetch('papers.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            allPapersData = await response.json();
        } catch (error) {
            console.error("Could not load paper data:", error);
            exploreFeedColumn.innerHTML = '<h3>Explore Feed</h3><div class="placeholder">Error loading papers.</div>';
            allPapersData = [];
        }
    }

    // --- RENDERING FUNCTIONS ---
    function createPaperCard(paper, context, itemType = 'paper') { // itemType for save button context
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

        const itemToSave = { type: 'paper', paperId: paper.id };
        const isSaved = findItemIndex(savedItems, itemToSave) !== -1;
        const saveButton = document.createElement('button');
        saveButton.className = 'save-toggle';
        saveButton.textContent = isSaved ? 'Saved' : 'Save Paper';
        if (isSaved) saveButton.classList.add('saved');
        saveButton.onclick = (e) => { e.stopPropagation(); toggleSaveItem(itemToSave); };
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

        // Buttons for "Saved Items" list (when it's a full paper)
        if (context === 'saved-list' && itemType === 'paper') {
            const addButton = document.createElement('button');
            addButton.className = 'add-to-builder';
            addButton.textContent = 'Add Paper →';
            addButton.onclick = (e) => { e.stopPropagation(); addItemToBuilder(itemToSave); };
            actions.appendChild(addButton);
            // Remove button is handled by toggleSaveItem, already present
        }
        
        // Buttons for "Builder" list (when it's a full paper)
        if (context === 'builder-list' && itemType === 'paper') {
            const upButton = document.createElement('button');
            upButton.className = 'reorder-up';
            upButton.textContent = '↑';
            upButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(itemToSave, -1); };
            actions.appendChild(upButton);

            const downButton = document.createElement('button');
            downButton.className = 'reorder-down';
            downButton.textContent = '↓';
            downButton.onclick = (e) => { e.stopPropagation(); moveBuilderItem(itemToSave, 1); };
            actions.appendChild(downButton);

            const removeButton = document.createElement('button'); // This removes from builder
            removeButton.className = 'remove-from-builder';
            removeButton.textContent = '×';
            removeButton.onclick = (e) => { e.stopPropagation(); removeItemFromBuilder(itemToSave); };
            actions.appendChild(removeButton);
        }
        card.appendChild(actions);
        return card;
    }

    function createPassageSnippetCard(passageItem, context) {
        const card = document.createElement('article');
        card.className = 'card passage-snippet-card'; // New class for styling if needed
        
        const passageTextEl = document.createElement('p');
        passageTextEl.textContent = `"${passageItem.passageText}"`;
        passageTextEl.style.fontStyle = 'italic';
        card.appendChild(passageTextEl);

        const sourcePaper = allPapersData.find(p => p.id === passageItem.paperId);
        if (sourcePaper) {
            const sourceInfo = document.createElement('p');
            sourceInfo.textContent = `From: ${sourcePaper.title}`;
            sourceInfo.style.fontSize = '0.9em';
            sourceInfo.style.color = '#586069';
            card.appendChild(sourceInfo);
        }

        const actions = document.createElement('div');
        actions.className = 'actions';

        // Save/Unsave button for this specific passage
        const isSaved = findItemIndex(savedItems, passageItem) !== -1;
        const saveButton = document.createElement('button');
        saveButton.className = 'save-toggle';
        saveButton.textContent = isSaved ? 'Passage Saved' : 'Save Passage';
        if (isSaved) saveButton.classList.add('saved');
        // This specific save button for a snippet card in saved/builder list is effectively a "remove from saved"
        saveButton.onclick = (e) => { e.stopPropagation(); toggleSaveItem(passageItem); };
        actions.appendChild(saveButton);


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

            const removeButton = document.createElement('button');
            removeButton.className = 'remove-from-builder';
            removeButton.textContent = '×';
            removeButton.onclick = (e) => { e.stopPropagation(); removeItemFromBuilder(passageItem); };
            actions.appendChild(removeButton);
        }
        card.appendChild(actions);
        return card;
    }


    function renderExploreFeed() { /* ... same as before ... */
        const feedContainer = exploreFeedColumn;
        feedContainer.innerHTML = '<h3>Explore Feed</h3>';

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
            passageCard.className = 'card passage-card'; // Existing class

            const passageTextEl = document.createElement('p');
            passageTextEl.textContent = trimmedSentence;
            passageTextEl.style.marginBottom = '10px';
            passageCard.appendChild(passageTextEl);
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'actions';

            const passageToSave = { type: 'passage', paperId: paper.id, passageText: trimmedSentence };
            const isPassageSaved = findItemIndex(savedItems, passageToSave) !== -1;
            const savePassageButton = document.createElement('button');
            savePassageButton.className = 'save-toggle';
            savePassageButton.textContent = isPassageSaved ? 'Passage Saved' : 'Save Passage';
            if (isPassageSaved) savePassageButton.classList.add('saved');
            savePassageButton.onclick = (e) => { e.stopPropagation(); toggleSaveItem(passageToSave); };
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

    function renderRelatedPapers() { /* ... same as before, uses createPaperCard ... */
        exploreRelatedColumn.innerHTML = '<h3>Related Papers</h3>';
        if (!currentPassageTextForRelated) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">Click a passage to see related papers.</div>'; return;
        }
        const passageKeywords = currentPassageTextForRelated.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0, 5);
        const relatedPapers = getRelevantPapers(passageKeywords, [currentPaperForPassagesId], 10);
        // Reuse renderColumn with createPaperCard for full papers
        exploreRelatedColumn.innerHTML = '<h3>Related Papers</h3>'; // Clear before adding
        if(relatedPapers.length === 0) {
            exploreRelatedColumn.innerHTML += '<div class="placeholder">No related papers found for this passage.</div>';
        } else {
            relatedPapers.forEach(paper => exploreRelatedColumn.appendChild(createPaperCard(paper, 'explore-related')));
        }
    }
    
    function getRelevantPapers(baseKeywords, excludePaperIds, count) { /* ... same as before ... */
        const candidates = allPapersData.filter(p => !excludePaperIds.includes(p.id));
        if (candidates.length === 0) return [];

        const scoredPapers = candidates.map(paper => {
            let score = 0;
            const paperText = `${paper.title} ${paper.abstract} ${(paper.keywords || []).join(" ")}`.toLowerCase();
            baseKeywords.forEach(kw => {
                if (paperText.includes(kw.toLowerCase())) score++;
            });
            (paper.keywords || []).forEach(pk => {
                if (baseKeywords.some(bk => pk.toLowerCase().includes(bk.toLowerCase()))) score += 2;
            });
            return { paper, score };
        }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

        let results = scoredPapers.map(item => item.paper);
        
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


    function renderSavedItemsList() { // Renamed and updated
        savedPapersColumn.innerHTML = '<h3>Saved Items</h3>'; // Changed title
        if (savedItems.length === 0) {
            savedPapersColumn.innerHTML += '<div class="placeholder">No items saved yet.</div>'; return;
        }
        // Saved items are added to the end, so they are chronological by save time.
        // To display newest first, iterate in reverse or reverse the array copy before iterating.
        // For now, default chronological:
        savedItems.forEach(item => {
            if (item.type === 'paper') {
                const paperData = allPapersData.find(p => p.id === item.paperId);
                if (paperData) {
                    savedPapersColumn.appendChild(createPaperCard(paperData, 'saved-list', 'paper'));
                }
            } else if (item.type === 'passage') {
                savedPapersColumn.appendChild(createPassageSnippetCard(item, 'saved-list'));
            }
        });
    }

    function renderBuilderList() { // Updated
        savedBuilderColumn.innerHTML = '<h3>Builder</h3>';
        if (builderItems.length === 0) {
            savedBuilderColumn.innerHTML += '<div class="placeholder">Add items from your saved list.</div>';
            renderLiveSuggestions(); // Still call suggestions
            return;
        }
        builderItems.forEach(item => {
            if (item.type === 'paper') {
                const paperData = allPapersData.find(p => p.id === item.paperId);
                if (paperData) {
                    savedBuilderColumn.appendChild(createPaperCard(paperData, 'builder-list', 'paper'));
                }
            } else if (item.type === 'passage') {
                savedBuilderColumn.appendChild(createPassageSnippetCard(item, 'builder-list'));
            }
        });
        renderLiveSuggestions();
    }

    function renderLiveSuggestions() { /* ... (logic might need slight adjustment if suggestions depend on passage content vs full paper content in builder) ... */
        savedSuggestionsColumn.innerHTML = '<h3>Live Suggestions</h3>';
        let suggestionKeywords = [];
        let contextItem = null;

        if (builderItems.length > 0) {
            contextItem = builderItems[builderItems.length - 1];
        } else if (activeTab === 'explore' && currentPassageTextForRelated) {
            // If builder is empty but exploring a passage, use that passage for context
             const sourcePaper = allPapersData.find(p => p.id === currentPaperForPassagesId);
             if(sourcePaper) {
                contextItem = { type: 'passage', paperId: currentPaperForPassagesId, passageText: currentPassageTextForRelated, sourceTitle: sourcePaper.title };
             }
        }

        if (contextItem) {
            if (contextItem.type === 'paper') {
                const paper = allPapersData.find(p => p.id === contextItem.paperId);
                if (paper) {
                    suggestionKeywords.push(...(paper.keywords || []));
                    suggestionKeywords.push(...paper.title.toLowerCase().split(/\s+/).filter(kw => kw.length > 3));
                }
            } else if (contextItem.type === 'passage') {
                suggestionKeywords.push(...contextItem.passageText.toLowerCase().split(/\s+/).filter(kw => kw.length > 3).slice(0,5));
                 if(contextItem.sourceTitle) { // If we added sourceTitle to passage item
                    suggestionKeywords.push(...contextItem.sourceTitle.toLowerCase().split(/\s+/).filter(kw => kw.length > 3));
                 }
            }
        }

        if (suggestionKeywords.length === 0) {
            savedSuggestionsColumn.innerHTML += '<div class="placeholder">Not enough context for suggestions.</div>'; return;
        }
        
        const excludePaperIds = [...new Set(savedItems.map(i => i.paperId)), ...new Set(builderItems.map(i => i.paperId))];
        if (currentPaperForPassagesId) excludePaperIds.push(currentPaperForPassagesId);

        const suggestedPapers = getRelevantPapers([...new Set(suggestionKeywords)], [...new Set(excludePaperIds)], 5);
        // Suggestions are always full papers for simplicity here
        if(suggestedPapers.length === 0) {
            savedSuggestionsColumn.innerHTML += '<div class="placeholder">No new suggestions found.</div>';
        } else {
             suggestedPapers.forEach(paper => savedSuggestionsColumn.appendChild(createPaperCard(paper, 'saved-suggestion')));
        }
    }

    // --- STATE MUTATION & ACTIONS ---
    function updateLocalStorage() {
        localStorage.setItem('paperPinSavedItems', JSON.stringify(savedItems));
        localStorage.setItem('paperPinBuilderItems', JSON.stringify(builderItems));
    }

    function toggleSaveItem(itemToToggle) { // Updated
        const index = findItemIndex(savedItems, itemToToggle);
        if (index > -1) {
            savedItems.splice(index, 1); // Unsave
            // If unsaving, also remove from builder if it was there
            const builderIndex = findItemIndex(builderItems, itemToToggle);
            if (builderIndex > -1) builderItems.splice(builderIndex, 1);
        } else {
            savedItems.push(itemToToggle); // Save (chronological)
        }
        updateLocalStorage();
        refreshAll();
    }

    function addItemToBuilder(itemToAdd) { // Updated
        if (findItemIndex(builderItems, itemToAdd) === -1) {
            builderItems.push(itemToAdd);
            updateLocalStorage();
            refreshAll();
        }
    }

    function removeItemFromBuilder(itemToRemove) { // Updated
        const index = findItemIndex(builderItems, itemToRemove);
        if (index > -1) {
            builderItems.splice(index, 1);
            updateLocalStorage();
            refreshAll();
        }
    }

    function moveBuilderItem(itemToMove, direction) { // Updated
        const index = findItemIndex(builderItems, itemToMove);
        if (index === -1) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= builderItems.length) return;
        [builderItems[index], builderItems[newIndex]] = [builderItems[newIndex], builderItems[index]];
        updateLocalStorage();
        refreshAll();
    }

    function loadMoreExplorePapers() { /* ... same as before ... */
        if (currentlyDisplayedExplorePapersCount >= allPapersData.length) return;
        currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, currentlyDisplayedExplorePapersCount + papersPerLoad);
        renderExploreFeed();
    }

    // --- TAB SWITCHING --- (Same)
    function switchTab(tabName, initialPaperIdForExplore = null) {
        activeTab = tabName;
        exploreView.style.display = (tabName === 'explore') ? 'flex' : 'none';
        savedView.style.display = (tabName === 'saved') ? 'flex' : 'none';
        exploreTabButton.classList.toggle('active', tabName === 'explore');
        savedTabButton.classList.toggle('active', tabName === 'saved');

        currentPassageTextForRelated = null;
        if (tabName === 'explore' && initialPaperIdForExplore) {
            currentPaperForPassagesId = initialPaperIdForExplore;
        } else {
            currentPaperForPassagesId = null;
        }
        refreshAll();
    }

    // --- `refreshAll()` ---
    function refreshAll() { // Updated to call new render function
        if (activeTab === 'explore') {
            renderExploreFeed();
            renderPassages();
            renderRelatedPapers();
        } else {
            renderSavedItemsList(); // Changed from renderSavedPapersList
            renderBuilderList();
        }
    }

    // --- EVENT LISTENERS --- (Same)
    exploreTabButton.onclick = () => switchTab('explore');
    savedTabButton.onclick = () => switchTab('saved');

    exploreFeedColumn.addEventListener('scroll', () => {
        if (activeTab === 'explore' && exploreFeedColumn.scrollTop + exploreFeedColumn.clientHeight >= exploreFeedColumn.scrollHeight - 150) {
            if (currentlyDisplayedExplorePapersCount < allPapersData.length) {
                loadMoreExplorePapers();
            }
        }
    });

    // --- INITIALIZATION --- (Same)
    async function initializeApp() {
        await loadPaperData();
        if (allPapersData && allPapersData.length > 0) {
            currentlyDisplayedExplorePapersCount = Math.min(allPapersData.length, papersPerLoad);
        }
        switchTab('explore');
    }

    initializeApp();
});
