export async function deleteDoc({ category, investor, filename }) {
  const response = await fetch('/.netlify/functions/delete-doc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, investor, filename })
  })
  if (!response.ok) {
    throw new Error('delete-doc failed')
  }
  return response.json()
}
