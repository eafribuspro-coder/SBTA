import type { SeatRow } from '../types/seatMap.types'

export function generateSeatLayout(
  totalRows: number,
  leftColumns: number,
  rightColumns: number,
  hasBackRow: boolean,
  backRowSeats: number
): SeatRow[] {
  const layout: SeatRow[] = []
  let counter = 1

  for (let row = 1; row <= totalRows; row++) {
    const seats = []

    for (let i = 0; i < leftColumns; i++) {
      const label = `${counter}`
      seats.push({
        id: label,
        label,
        side: 'left' as const,
        type: 'normal' as const,
        position: { row, col: i + 1 },
      })
      counter++
    }

    for (let i = 0; i < rightColumns; i++) {
      const label = `${counter}`
      seats.push({
        id: label,
        label,
        side: 'right' as const,
        type: 'normal' as const,
        position: { row, col: leftColumns + i + 1 },
      })
      counter++
    }

    layout.push({ row, seats })
  }

  if (hasBackRow && backRowSeats > 0) {
    const backSeats = []
    for (let i = 0; i < backRowSeats; i++) {
      const label = `${counter}`
      backSeats.push({
        id: label,
        label,
        side: 'back' as const,
        type: 'normal' as const,
        position: { row: totalRows + 1, col: i + 1 },
      })
      counter++
    }
    layout.push({ row: totalRows + 1, seats: backSeats })
  }

  return layout
}

export function generateDefaultLayoutFromTotalSeats(totalSeats: number): {
  rows: number
  leftColumns: number
  rightColumns: number
  hasBackRow: boolean
  backRowSeats: number
} {
  if (totalSeats <= 16) {
    const rows = Math.ceil(totalSeats / 2)
    return { rows, leftColumns: 1, rightColumns: 1, hasBackRow: false, backRowSeats: 0 }
  }
  if (totalSeats <= 40) {
    const backRowSeats = 4
    const mainSeats = totalSeats - backRowSeats
    if (mainSeats % 3 === 0) {
      return { rows: mainSeats / 3, leftColumns: 2, rightColumns: 1, hasBackRow: true, backRowSeats }
    }
    const rows = Math.floor(mainSeats / 3)
    const remainder = mainSeats - rows * 3
    if (remainder === 0) {
      return { rows, leftColumns: 2, rightColumns: 1, hasBackRow: true, backRowSeats }
    }
    const rows2 = Math.ceil(totalSeats / 3)
    return { rows: rows2, leftColumns: 2, rightColumns: 1, hasBackRow: false, backRowSeats: 0 }
  }
  const backRowSeats = 5
  const mainSeats = totalSeats - backRowSeats
  const rows = Math.ceil(mainSeats / 4)
  return { rows, leftColumns: 2, rightColumns: 2, hasBackRow: true, backRowSeats }
}

interface LegacySeatCell {
  id: string
  type: string
  label: string
}

export function normalizeLegacyLayout(
  rawLayout: LegacySeatCell[][],
  leftColumns: number
): SeatRow[] {
  return rawLayout.map((rowCells, rowIndex) => {
    const isBackRow = rowCells.some(c => c.id.startsWith('back-'))
    const normalCells = rowCells.filter(c => !c.id.includes('aisle') && c.type !== 'disabled')

    const seats = normalCells.map((cell, cellIndex) => {
      const isBack = cell.id.startsWith('back-')
      let side: 'left' | 'right' | 'back'
      if (isBack) {
        side = 'back'
      } else {
        const colStr = cell.id.split('-')[1]
        const col = parseInt(colStr, 10)
        side = col < leftColumns ? 'left' : 'right'
      }

      const seatType = cell.type === 'disabled' || cell.type === 'hors_service'
        ? 'hors_service'
        : cell.type === 'vip'
          ? 'vip'
          : cell.type === 'handicape'
            ? 'handicape'
            : 'normal'

      return {
        id: cell.label || cell.id,
        label: cell.label || cell.id,
        side,
        type: seatType as 'normal' | 'vip' | 'handicape' | 'hors_service',
        position: {
          row: isBackRow ? rowIndex + 1 : rowIndex + 1,
          col: cellIndex + 1,
        },
      }
    })

    return { row: rowIndex + 1, seats }
  })
}
