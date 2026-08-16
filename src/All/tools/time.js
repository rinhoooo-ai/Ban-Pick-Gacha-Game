// Timer

let countdown;

export function startCountdown(duration, onTimeout) {
    const display = document.querySelector('.timer');
    let timer = duration, minutes, seconds;

    if (countdown) {
        clearInterval(countdown);
    }
    countdown = setInterval(function () {
        seconds = parseInt(timer, 10);

        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = seconds;

        if (--timer < 0) {
            clearInterval(countdown);
            if (typeof onTimeout === 'function') {
                onTimeout();
                return;
            }
        }
    }, 1000);
}

// Dừng hẳn countdown đang chạy (VD khi ban/pick đã kết thúc), không
// cho interval cũ tiếp tục ghi đè lên chữ hiển thị.
export function stopCountdown() {
    if (countdown) {
        clearInterval(countdown);
        countdown = null;
    }
}

export function resetTime(duration) {
    startCountdown(duration);
}