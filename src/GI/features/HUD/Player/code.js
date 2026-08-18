import { GenshinCharacter } from "../../../database/character.js";
import { logic_BP } from "../../../database/logic_bp.js";
import { resetTime, startCountdown, stopCountdown } from "../../../../All/tools/time.js";

//Time setting value
let banTimeSetting = 30;
let pickTimeSetting = 60;
let isBanTimeSet = false;
let isPickTimeSet = false;
//Global variables
let globalTeam1 = "Team 1";
let globalTeam2 = "Team 2";
let globalBossChoice = "1";
let champion_number = 27;
let i = 1;
let l = 0, r = 0, lp = 0, rp = 0;
let current, current_log;
let current_n = 0;
// Logic variables
let tempSelectedCharacter = null;
let isBanPickFinished = false;
let confirmBtn = null;
let returnBtn = null;
let isSettingsSaved = false;

// ==== Return (undo) feature ====
// Mỗi khi 1 bước ban/pick hoàn tất, push tên nhân vật (hoặc null nếu no-ban)
// vào đây. Return = pop ra + lùi i lại 1 bước.
let pickStack = [];

const BlueBanSlot = ['b1', 'b2', 'b3'];
const RedBanSlot = ['r1', 'r2', 'r3'];
const BluePickSlot = ['bp1', 'bp2', 'bp3', 'bp4', 'bp5', 'bp6', 'bp7', 'bp8'];
const RedPickSlot = ['rp1', 'rp2', 'rp3', 'rp4', 'rp5', 'rp6', 'rp7', 'rp8'];

function ban_sound_play() {
    var audio = document.getElementById("ban-sound");
    audio.play();
}

function pick_sound_play() {
    var audio = document.getElementById("pick-sound");
    audio.play();
}

function playBackgroundMusic() {
    var audio_bp = document.getElementById("bp-sound");
    audio_bp.play().catch(() => {
        document.addEventListener('click', () => {
            audio_bp.play();
            audio_bp.loop = true;
        }, { once: true });
    });
    audio_bp.loop = true;
}

function check_selection(name) {
    for (let i in GenshinCharacter) {
        if (GenshinCharacter[i].shortName == name) {
            return GenshinCharacter[i].selected;
        }
    }
}

function picking_selection(name) {
    for (let i in GenshinCharacter) {
        if (GenshinCharacter[i].shortName == name) {
            return GenshinCharacter[i].selected = true;
        }
    }
}

// Ngược lại với picking_selection: bỏ đánh dấu "đã chọn" để nhân vật
// có thể được chọn lại sau khi Return.
function unselectCharacter(shortName) {
    if (!shortName) return;
    const charObj = GenshinCharacter.find(c => c.shortName === shortName);
    if (charObj) charObj.selected = false;

    const listImg = document.querySelector(`.character-list img[alt="${shortName.toLowerCase()}"]`);
    if (listImg) {
        listImg.style.filter = '';
        listImg.style.backgroundColor = '';
    }
}

// Xoá sạch 1 slot (ban hoặc pick) về trạng thái trống ban đầu.
function clearSlotUI(slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = '';
    slot.classList.remove('filled', 'active', 'blue-blink', 'red-blink', 'selected');
}

function decrementCounterForType(type) {
    if (type == "RedBan") r--;
    else if (type == "BlueBan") l--;
    else if (type == "BluePick") lp--;
    else if (type == "RedPick") rp--;
}

function updateReturnButtonState() {
    if (returnBtn) returnBtn.disabled = pickStack.length === 0;
}

// Lùi lại 1 bước trong logic_BP. Gọi nhiều lần liên tiếp = lùi nhiều bước.
export function returnStep() {
    if (pickStack.length === 0) return;
    stopCountdown();

    if (isBanPickFinished) {
        document.querySelector('.character-filter')?.classList.remove('hide-banpick-ui');
        document.querySelector('.character-list')?.classList.remove('hide-banpick-ui');
        if (confirmBtn) {
            confirmBtn.classList.remove('hide-banpick-ui');
            confirmBtn.style.display = '';
        }
        isBanPickFinished = false;
        document.body.classList.remove('banpick-ended');
        hideBossWallpaper();
    } else {
        // Xoá preview/active của bước đang dang dở (chưa confirm) trước khi lùi
        clearSlotUI(current);
    }

    const shortName = pickStack.pop();

    const prevStep = i - 1;
    const prevType = logic_BP[prevStep];
    decrementCounterForType(prevType);
    i = prevStep;

    check();
    clearSlotUI(current);
    unselectCharacter(shortName);

    tempSelectedCharacter = null;
    if (confirmBtn) confirmBtn.disabled = true;

    begin();
    updateReturnButtonState();
}
// ==== End Return feature ====

function updateTeamTurn(i) {
    const team1Element = document.getElementById('team1-name');
    const team2Element = document.getElementById('team2-name');
    const team1Container = team1Element.closest('.roomTeamName');
    const team2Container = team2Element.closest('.roomTeamName');

    team1Container.classList.remove('turn');
    team2Container.classList.remove('turn');
    team1Element.textContent = globalTeam1;
    team2Element.textContent = globalTeam2;

    if (logic_BP[i] == "RedBan") {
        team2Element.textContent = `${team2Element.textContent}'s BANNING...`;
        team2Container.classList.add('turn');
    }
    else if (logic_BP[i] == "BlueBan") {
        team1Element.textContent = `${team1Element.textContent}'s BANNING...`;
        team1Container.classList.add('turn');
    }
    else if (logic_BP[i] == "BluePick") {
        team1Element.textContent = `${team1Element.textContent}'s PICKING...`;
        team1Container.classList.add('turn');
    }
    else if (logic_BP[i] == "RedPick") {
        team2Element.textContent = `${team2Element.textContent}'s PICKING...`;
        team2Container.classList.add('turn');
    }
}

function handleNoBan(slotId) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = '';
    slot.classList.remove('active', 'blue-blink', 'red-blink');
    slot.classList.add('filled');
    const noBanDiv = document.createElement('div');
    noBanDiv.className = 'no-ban-icon';
    noBanDiv.title = 'No Ban';
    noBanDiv.style.backgroundImage = 'url("../../../../All/asset/icons/normal/no_ban.svg")';
    slot.appendChild(noBanDiv);
}

function getValidRandomCharacter() {
    const teamSlots = getTeamSlotsByCurrent();
    const validCharacters = GenshinCharacter.filter(char => {
        if (char.selected) return false;
        if (countGroupInTeam(char.fullName, teamSlots, current) > 0) return false;
        return true;
    });
    if (validCharacters.length === 0) return null;
    const idx = Math.floor(Math.random() * validCharacters.length);
    return validCharacters[idx];
}

function handleCharacterPick(character, slotId) {
    picking_selection(character.shortName);
    updateSlotUI(slotId, character);
    setSlotSelected(slotId);

    if (current_log === 'ban') {
        const slot = document.getElementById(current);
        const img = slot.querySelector('img');
        if (img) img.classList.add('grayscaled');
    }

    const listImgPick = document.querySelector(`.character-list img[alt="${character.shortName.toLowerCase()}"]`);
    if (listImgPick) {
        listImgPick.style.filter = 'grayscale(1)';
        listImgPick.style.backgroundColor = '#ccc';
    }
}

function handleBanPickEnd() {
    const timer = document.querySelector('.timer');
    if (timer) timer.textContent = 'Ended';
    stopCountdown();
    if (confirmBtn) confirmBtn.disabled = true;
    isBanPickFinished = true;
    tempSelectedCharacter = null;
    document.body.classList.add('banpick-ended');

    const team1Element = document.getElementById('team1-name');
    const team2Element = document.getElementById('team2-name');
    if (team1Element) team1Element.textContent = globalTeam1;
    if (team2Element) team2Element.textContent = globalTeam2;

    hideBanPickUI();
    showBossWallpaper();
}

function showBossWallpaper() {
    const player = document.querySelector('.banpick-player');
    const actions = document.querySelector('.banpick-actions');
    if (!player || !actions) return;

    let bossImg = document.getElementById('boss-wallpaper');
    if (!bossImg) {
        bossImg = document.createElement('img');
        bossImg.id = 'boss-wallpaper';
        bossImg.style.width = '100%';
        bossImg.style.maxHeight = '500px';
        bossImg.style.objectFit = 'contain';
        player.insertBefore(bossImg, actions);
    }
    bossImg.src = `../../../asset/images/boss/boss${globalBossChoice}.png`;
}

function hideBossWallpaper() {
    const bossImg = document.getElementById('boss-wallpaper');
    if (bossImg) bossImg.remove();
}

function begin() {
    if (!isSettingsSaved) return;

    let slot;
    if (i >= champion_number || !logic_BP[i]) {
        handleBanPickEnd();
        return;
    }

    if (logic_BP[i] == "RedBan") {
        current = RedBanSlot[r];
        current_n = r;
        current_log = 'ban';
        slot = document.getElementById(current);
        if (slot) slot.classList.add('active', 'red-blink');
        startCountdown(
            banTimeSetting,
            () => {
                if (i >= champion_number || !logic_BP[i]) return;
                handleNoBan(current);
                if (slot) slot.classList.remove('active', 'red-blink');
                pickStack.push(null);
                r++;
                i++;
                ban_sound_play();
                check();
                begin();
                if (confirmBtn) confirmBtn.disabled = true;
                updateReturnButtonState();
            }
        );
        updateTeamTurn(i);
    }
    else if (logic_BP[i] == "BlueBan") {
        current = BlueBanSlot[l];
        current_n = l;
        current_log = 'ban';
        slot = document.getElementById(current);
        if (slot) slot.classList.add('active', 'blue-blink');
        startCountdown(
            banTimeSetting,
            () => {
                if (i >= champion_number || !logic_BP[i]) return;
                handleNoBan(current);
                if (slot) slot.classList.remove('active', 'blue-blink');
                pickStack.push(null);
                l++;
                i++;
                ban_sound_play();
                check();
                begin();
                if (confirmBtn) confirmBtn.disabled = true;
                updateReturnButtonState();
            }
        );
        updateTeamTurn(i);
    }
    else if (logic_BP[i] == "BluePick") {
        current = BluePickSlot[lp];
        current_n = lp;
        current_log = 'pick';
        slot = document.getElementById(current);
        slot.classList.add('active', 'blue-blink');
        startCountdown(
            pickTimeSetting,
            () => {
                if (i >= champion_number || !logic_BP[i]) return;
                if (tempSelectedCharacter) {
                    handleCharacterPick(tempSelectedCharacter, current);
                    pick_sound_play();
                } else {
                    const randomChar = getValidRandomCharacter();
                    if (randomChar) {
                        tempSelectedCharacter = randomChar;
                        handleCharacterPick(randomChar, current);
                        pick_sound_play();
                    }
                }
                pickStack.push(tempSelectedCharacter ? tempSelectedCharacter.shortName : null);
                lp++;
                i++;
                if (i >= champion_number) {
                    handleBanPickEnd();
                    updateReturnButtonState();
                    return;
                }
                check();
                begin();
                if (confirmBtn) confirmBtn.disabled = true;
                tempSelectedCharacter = null;
                updateReturnButtonState();
            }
        );
        updateTeamTurn(i);
    }
    else if (logic_BP[i] == "RedPick") {
        current = RedPickSlot[rp];
        current_n = rp;
        current_log = 'pick';
        slot = document.getElementById(current);
        slot.classList.add('active', 'red-blink');
        startCountdown(
            pickTimeSetting,
            () => {
                if (i >= champion_number || !logic_BP[i]) return;
                if (tempSelectedCharacter) {
                    handleCharacterPick(tempSelectedCharacter, current);
                    pick_sound_play();
                } else {
                    const randomChar = getValidRandomCharacter();
                    if (randomChar) {
                        tempSelectedCharacter = randomChar;
                        handleCharacterPick(randomChar, current);
                        pick_sound_play();
                    }
                }
                pickStack.push(tempSelectedCharacter ? tempSelectedCharacter.shortName : null);
                rp++;
                i++;
                if (i >= champion_number) {
                    handleBanPickEnd();
                    updateReturnButtonState();
                    return;
                }
                check();
                begin();
                if (confirmBtn) confirmBtn.disabled = true;
                tempSelectedCharacter = null;
                updateReturnButtonState();
            }
        );
        updateTeamTurn(i);
    }
    else {
        current_log = 'stop';
    }
}

function check() {
    if (logic_BP[i] == "RedBan") {
        current = RedBanSlot[r];
        current_n = r;
        current_log = 'ban';
    }
    else if (logic_BP[i] == "BlueBan") {
        current = BlueBanSlot[l];
        current_n = l;
        current_log = 'ban';
    }
    else if (logic_BP[i] == "BluePick") {
        current = BluePickSlot[lp];
        current_n = lp;
        current_log = 'pick';
    }
    else if (logic_BP[i] == "RedPick") {
        current = RedPickSlot[rp];
        current_n = rp;
        current_log = 'pick';
    }
    else {
        current_log = 'stop';
    }
}

function setSlotSelected(slotId) {
    const slot = document.getElementById(slotId);
    if (slot) {
        slot.classList.remove('active', 'blue-blink', 'red-blink');
        slot.classList.add('selected');
        setTimeout(() => slot.classList.remove('selected'), 600);
    }
}

function showAlert(message, resetMessage = null) {
    const alertElement = document.getElementById('duplicate-alert');
    if (!alertElement) return;
    alertElement.style.display = 'block';
    alertElement.textContent = message;
    setTimeout(() => {
        alertElement.style.display = 'none';
        if (resetMessage) alertElement.textContent = resetMessage;
    }, 2000);
}

function getTeamSlotsByCurrent() {
    if (current_log !== 'pick') return [];
    if (BluePickSlot.includes(current)) return BluePickSlot;
    if (RedPickSlot.includes(current)) return RedPickSlot;
    return [];
}

function removeSpaces(inputText) {
    if (inputText) {
        return inputText.replace(/\s/g, "");
    }
    return "";
}

function countGroupInTeam(group, teamSlots, excludeSlotId = null) {
    let count = 0;
    for (let slotId of teamSlots) {
        if (slotId === excludeSlotId) continue;
        const slot = document.getElementById(slotId);
        if (slot && slot.classList.contains('filled')) {
            const img = slot.querySelector('img');
            if (img) {
                const imgFile = img.src.split('/').pop().replace('.webp', '');
                const char = GenshinCharacter.find(c => c.shortName.toLowerCase() === imgFile);
                if (char && char.fullName === group) count++;
            }
        }
    }
    return count;
}

export function chooseCharacter(character) {
    if (isBanPickFinished) return;

    // Check the other version of this character
    if (character.fullName) {
        const teamSlots = getTeamSlotsByCurrent();
        if (countGroupInTeam(character.fullName, teamSlots, current) > 0) {
            showAlert("You can't choose this character again!");
            return;
        }
    }

    // Check the character is already selected
    if (check_selection(character.shortName) === true) {
        showAlert("You can't choose this character again!");
        return;
    }

    tempSelectedCharacter = character;
    updateSlotUI(current, character);

    if (!isBanPickFinished) {
        document.getElementById('confirm').disabled = false;
    }
}

function updateSlotUI(slotId, character) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = '';
    slot.classList.add('filled');

    if (current_log === 'ban') {
        const img = document.createElement('img');
        let file = removeSpaces(character.shortName.toLowerCase());
        img.src = `../../../asset/images/selection_character/${file}.webp`;
        slot.appendChild(img);

        let element = character.elements;
        const img_element = document.createElement('div');
        img_element.style.backgroundImage = `url('../../../asset/icons/elements/${element}.svg')`;
        img_element.alt = element;
        img_element.classList.add('element-icon');
        slot.appendChild(img_element);
    } else if (current_log === 'pick') {
        slot.innerHTML = `
            <img src="../../../asset/images/character/${removeSpaces(character.shortName.toLowerCase())}.webp" alt="${removeSpaces(character.shortName.toLowerCase())}">
            <div class="pick-overlay"></div>
            <div class="pick-info-row">
                <div class="pick-icons-row">
                    <span class="element-icon" style="background-image:url('../../../asset/icons/elements/${character.elements}.svg')"></span>
                    <span class="weapon-icon" style="background-image:url('../../../asset/icons/weapons/${character.weapon}.png')"></span>
            <span class="star-icon" style="background-image:url('../../../asset/icons/rarities/star-${character.stars}.svg')"></span>
                </div>
                <div class="pick-name">${character.fullName}</div>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const settingsIcon = document.getElementById('settings-icon');
    const settingsModal = document.getElementById('settings-modal');

    const characterFilter = document.querySelector('.character-filter');
    const characterList = document.querySelector('.character-list');
    const confirmButton = document.getElementById('confirm');

    if (settingsIcon && settingsModal) {
        settingsIcon.addEventListener('click', () => {
            settingsModal.style.display = 'flex';
        });

        settingsModal.addEventListener('click', (event) => {
            if (event.target === settingsModal) {
                settingsModal.style.display = 'none';
            }
        });
    }

    window.addEventListener('message', (event) => {
        const { settingsData, settingsSaved } = event.data;

        if (settingsSaved) {
            isSettingsSaved = true;

            // Update team names
            if (settingsData.team1Name) {
                globalTeam1 = settingsData.team1Name;
                document.getElementById('team1-name').textContent = settingsData.team1Name;
            }
            if (settingsData.team2Name) {
                globalTeam2 = settingsData.team2Name;
                document.getElementById('team2-name').textContent = settingsData.team2Name;
            }
            // Update boss wallpaper
            if (settingsData.bossChoice) {
                globalBossChoice = settingsData.bossChoice;
            }
            // Update team scores
            if (settingsData.team1Score) {
                document.getElementById('team1-score').textContent = settingsData.team1Score;
            }
            if (settingsData.team2Score) {
                document.getElementById('team2-score').textContent = settingsData.team2Score;
            }

            // Update time setting
            if (settingsData.banTime && !isBanTimeSet) {
                banTimeSetting = settingsData.banTime;
                isBanTimeSet = true;
            }
            if (settingsData.pickTime && !isPickTimeSet) {
                pickTimeSetting = settingsData.pickTime;
                isPickTimeSet = true;
            }

            // Update volume
            if (settingsData.volume !== undefined) {
                settingsData.volume /= 100;
                bpSound.volume = settingsData.volume;
                banSound.volume = settingsData.volume;
                pickSound.volume = settingsData.volume;
            }

            characterFilter.style.pointerEvents = 'auto';
            characterList.style.pointerEvents = 'auto';
            confirmButton.style.pointerEvents = 'auto';
            const returnButton = document.getElementById('return-btn');
            if (returnButton) returnButton.style.pointerEvents = 'auto';
            isSettingsSaved = true;

            playBackgroundMusic();
            begin();
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const volumeDropdown = document.getElementById('volume-dropdown');
    const volumeControl = document.getElementById('volume-control');
    const bpVolumeRange = document.getElementById('bp-volume-range');
    const banVolumeRange = document.getElementById('ban-volume-range');
    const pickVolumeRange = document.getElementById('pick-volume-range');
    const bpSound = document.getElementById('bp-sound');
    const banSound = document.getElementById('ban-sound');
    const pickSound = document.getElementById('pick-sound');

    volumeDropdown.addEventListener('click', () => {
        if (volumeControl.style.display === 'block') {
            volumeControl.style.display = 'none';
        } else {
            volumeControl.style.display = 'block';
        }
    });

    bpVolumeRange.addEventListener('input', () => {
        const volume = bpVolumeRange.value / 100;
        bpSound.volume = volume;
    });

    banVolumeRange.addEventListener('input', () => {
        const volume = banVolumeRange.value / 100;
        banSound.volume = volume;
    });

    pickVolumeRange.addEventListener('input', () => {
        const volume = pickVolumeRange.value / 100;
        pickSound.volume = volume;
    });
});

function hideBanPickUI() {
    document.querySelector('.character-filter')?.classList.add('hide-banpick-ui');
    document.querySelector('.character-list')?.classList.add('hide-banpick-ui');
    const confirmBtn = document.getElementById('confirm');
    if (confirmBtn) {
        confirmBtn.classList.add('hide-banpick-ui');
        confirmBtn.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const confirmButton = document.getElementById('confirm');
    confirmBtn = confirmButton;
    confirmBtn.disabled = true;

    confirmBtn.addEventListener('click', () => {
        if (!tempSelectedCharacter) return;

        handleCharacterPick(tempSelectedCharacter, current);

        if (current_log === 'ban') ban_sound_play();
        else if (current_log === 'pick') pick_sound_play();

        pickStack.push(tempSelectedCharacter.shortName);

        if (logic_BP[i] == "RedBan") r++;
        else if (logic_BP[i] == "BlueBan") l++;
        else if (logic_BP[i] == "BluePick") lp++;
        else if (logic_BP[i] == "RedPick") rp++;

        i++;
        if (i >= champion_number) {
            handleBanPickEnd();
            updateReturnButtonState();
            return;
        }

        check();
        begin();

        tempSelectedCharacter = null;
        confirmBtn.disabled = true;
        updateReturnButtonState();
    });
});

// Nút Return
document.addEventListener('DOMContentLoaded', () => {
    returnBtn = document.getElementById('return-btn');
    if (returnBtn) {
        returnBtn.disabled = true;
        returnBtn.addEventListener('click', () => {
            returnStep();
        });
    }
});