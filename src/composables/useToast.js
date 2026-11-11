import { ref } from 'vue'

const message = ref('')
let timer

export function useToast() {
  function show(text) {
    clearTimeout(timer)
    message.value = text
    timer = setTimeout(() => { message.value = '' }, 2800)
  }
  return { message, show }
}
