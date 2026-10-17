import {
  IPoint2D,
  IPathPlannerPath,
  IRotationTarget,
} from '../../models/pathplanner'

export interface ISampledPoint {
  readonly pos: IPoint2D
  readonly waypointRelativePos: number
  readonly tangentAngleDegrees: number
  readonly rotationDegrees: number
  readonly cumulativeDistanceMeters: number
  readonly estimatedTimeSeconds: number
}

export function evaluateCubicBezier(
  p0: IPoint2D,
  p1: IPoint2D,
  p2: IPoint2D,
  p3: IPoint2D,
  t: number
): IPoint2D {
  const oneMinusT = 1.0 - t
  const oneMinusT2 = oneMinusT * oneMinusT
  const oneMinusT3 = oneMinusT2 * oneMinusT
  const t2 = t * t
  const t3 = t2 * t

  return {
    x:
      oneMinusT3 * p0.x +
      3.0 * oneMinusT2 * t * p1.x +
      3.0 * oneMinusT * t2 * p2.x +
      t3 * p3.x,
    y:
      oneMinusT3 * p0.y +
      3.0 * oneMinusT2 * t * p1.y +
      3.0 * oneMinusT * t2 * p2.y +
      t3 * p3.y,
  }
}

export function evaluateCubicDerivative(
  p0: IPoint2D,
  p1: IPoint2D,
  p2: IPoint2D,
  p3: IPoint2D,
  t: number
): IPoint2D {
  const oneMinusT = 1.0 - t
  const oneMinusT2 = oneMinusT * oneMinusT
  const t2 = t * t

  return {
    x:
      3.0 * oneMinusT2 * (p1.x - p0.x) +
      6.0 * oneMinusT * t * (p2.x - p1.x) +
      3.0 * t2 * (p3.x - p2.x),
    y:
      3.0 * oneMinusT2 * (p1.y - p0.y) +
      6.0 * oneMinusT * t * (p2.y - p1.y) +
      3.0 * t2 * (p3.y - p2.y),
  }
}

function normalizeDegrees(degrees: number): number {
  let normalized = degrees % 360.0
  if (normalized > 180.0) {
    normalized -= 360.0
  } else if (normalized < -180.0) {
    normalized += 360.0
  }
  return normalized
}

function interpolateAngleDegrees(a: number, b: number, t: number): number {
  const diff = normalizeDegrees(b - a)
  return normalizeDegrees(a + diff * t)
}

export function getRotationAtWaypointRelativePos(
  path: IPathPlannerPath,
  u: number,
  sampledPosition?: IPoint2D
): number {
  // Check active point towards zones first
  if (path.pointTowardsZones && sampledPosition) {
    for (const zone of path.pointTowardsZones) {
      if (
        u >= zone.minWaypointRelativePos &&
        u <= zone.maxWaypointRelativePos
      ) {
        const dx = zone.fieldPosition.x - sampledPosition.x
        const dy = zone.fieldPosition.y - sampledPosition.y
        const targetDeg = (Math.atan2(dy, dx) * 180.0) / Math.PI
        return normalizeDegrees(targetDeg + (zone.rotationOffset ?? 0.0))
      }
    }
  }

  const startRot =
    path.idealStartingState?.rotation ??
    path.rotationTargets[0]?.rotationDegrees ??
    0.0
  const endRot = path.goalEndState?.rotation ?? startRot

  if (!path.rotationTargets || path.rotationTargets.length === 0) {
    const totalWaypoints = Math.max(1, path.waypoints.length - 1)
    const t = Math.max(0, Math.min(1, u / totalWaypoints))
    return interpolateAngleDegrees(startRot, endRot, t)
  }

  const targets: Array<IRotationTarget> = [
    { waypointRelativePos: 0.0, rotationDegrees: startRot },
    ...[...path.rotationTargets].sort(
      (a, b) => a.waypointRelativePos - b.waypointRelativePos
    ),
    {
      waypointRelativePos: Math.max(1, path.waypoints.length - 1),
      rotationDegrees: endRot,
    },
  ]

  for (let i = 0; i < targets.length - 1; i++) {
    const curr = targets[i]
    const next = targets[i + 1]
    if (u >= curr.waypointRelativePos && u <= next.waypointRelativePos) {
      const span = next.waypointRelativePos - curr.waypointRelativePos
      const t = span <= 0.0001 ? 0.0 : (u - curr.waypointRelativePos) / span
      return interpolateAngleDegrees(
        curr.rotationDegrees,
        next.rotationDegrees,
        t
      )
    }
  }

  return endRot
}

export function samplePath(
  path: IPathPlannerPath,
  samplesPerSegment: number = 25
): ReadonlyArray<ISampledPoint> {
  const waypoints = path.waypoints
  if (!waypoints || waypoints.length < 2) {
    return []
  }

  const sampled: Array<ISampledPoint> = []
  let cumulativeDistance = 0.0
  const maxVel = path.globalConstraints?.maxVelocity || 4.0

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p0 = waypoints[i].anchor
    const p1 = waypoints[i].nextControl ?? p0
    const p3 = waypoints[i + 1].anchor
    const p2 = waypoints[i + 1].prevControl ?? p3

    const steps = i === waypoints.length - 2 ? samplesPerSegment : samplesPerSegment - 1

    for (let s = 0; s <= steps; s++) {
      const t = s / samplesPerSegment
      const u = i + t
      const pos = evaluateCubicBezier(p0, p1, p2, p3, t)
      const deriv = evaluateCubicDerivative(p0, p1, p2, p3, t)
      const tangentDeg = (Math.atan2(deriv.y, deriv.x) * 180.0) / Math.PI

      if (sampled.length > 0) {
        const last = sampled[sampled.length - 1].pos
        const dx = pos.x - last.x
        const dy = pos.y - last.y
        cumulativeDistance += Math.sqrt(dx * dx + dy * dy)
      }

      // Check constraint zones for local max velocity
      let segmentMaxVel = maxVel
      if (path.constraintZones) {
        for (const zone of path.constraintZones) {
          if (
            u >= zone.minWaypointRelativePos &&
            u <= zone.maxWaypointRelativePos
          ) {
            segmentMaxVel = Math.min(
              segmentMaxVel,
              zone.constraints.maxVelocity
            )
          }
        }
      }

      const rot = getRotationAtWaypointRelativePos(path, u, pos)
      const estTime = cumulativeDistance / Math.max(0.5, segmentMaxVel)

      sampled.push({
        pos,
        waypointRelativePos: u,
        tangentAngleDegrees: tangentDeg,
        rotationDegrees: rot,
        cumulativeDistanceMeters: cumulativeDistance,
        estimatedTimeSeconds: estTime,
      })
    }
  }

  return sampled
}

export function getStateAtTime(
  sampledPoints: ReadonlyArray<ISampledPoint>,
  timeSeconds: number
): { pos: IPoint2D; rotationDegrees: number; waypointRelativePos: number } | null {
  if (sampledPoints.length === 0) {
    return null
  }

  if (timeSeconds <= sampledPoints[0].estimatedTimeSeconds) {
    const first = sampledPoints[0]
    return {
      pos: first.pos,
      rotationDegrees: first.rotationDegrees,
      waypointRelativePos: first.waypointRelativePos,
    }
  }

  const last = sampledPoints[sampledPoints.length - 1]
  if (timeSeconds >= last.estimatedTimeSeconds) {
    return {
      pos: last.pos,
      rotationDegrees: last.rotationDegrees,
      waypointRelativePos: last.waypointRelativePos,
    }
  }

  for (let i = 0; i < sampledPoints.length - 1; i++) {
    const curr = sampledPoints[i]
    const next = sampledPoints[i + 1]
    if (
      timeSeconds >= curr.estimatedTimeSeconds &&
      timeSeconds <= next.estimatedTimeSeconds
    ) {
      const dt = next.estimatedTimeSeconds - curr.estimatedTimeSeconds
      const t = dt <= 0.0001 ? 0.0 : (timeSeconds - curr.estimatedTimeSeconds) / dt
      return {
        pos: {
          x: curr.pos.x + (next.pos.x - curr.pos.x) * t,
          y: curr.pos.y + (next.pos.y - curr.pos.y) * t,
        },
        rotationDegrees: interpolateAngleDegrees(
          curr.rotationDegrees,
          next.rotationDegrees,
          t
        ),
        waypointRelativePos:
          curr.waypointRelativePos +
          (next.waypointRelativePos - curr.waypointRelativePos) * t,
      }
    }
  }

  return {
    pos: last.pos,
    rotationDegrees: last.rotationDegrees,
    waypointRelativePos: last.waypointRelativePos,
  }
}
