import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  evaluateCubicBezier,
  samplePath,
  getRotationAtWaypointRelativePos,
} from '../../src/lib/pathplanner/bezier-math'
import {
  parsePath,
  parseAuto,
  extractPathNamesFromCommand,
} from '../../src/lib/pathplanner/context-loader'

describe('PathPlanner Diff Engine', () => {
  it('correctly evaluates a cubic bezier curve', () => {
    const p0 = { x: 0, y: 0 }
    const p1 = { x: 0, y: 1 }
    const p2 = { x: 1, y: 1 }
    const p3 = { x: 1, y: 0 }

    const midpoint = evaluateCubicBezier(p0, p1, p2, p3, 0.5)
    assert.ok(Math.abs(midpoint.x - 0.5) < 0.001)
    assert.ok(Math.abs(midpoint.y - 0.75) < 0.001)
  })

  it('parses PathPlanner path JSON and samples waypoints', () => {
    const samplePathJson = JSON.stringify({
      version: '2025.0',
      waypoints: [
        {
          anchor: { x: 1.0, y: 2.0 },
          prevControl: null,
          nextControl: { x: 2.0, y: 2.0 },
        },
        {
          anchor: { x: 4.0, y: 5.0 },
          prevControl: { x: 3.0, y: 5.0 },
          nextControl: null,
        },
      ],
      rotationTargets: [{ waypointRelativePos: 0.5, rotationDegrees: 90.0 }],
      constraintZones: [],
      pointTowardsZones: [],
      eventMarkers: [],
      globalConstraints: {
        maxVelocity: 4.5,
        maxAcceleration: 3.0,
        maxAngularVelocity: 540.0,
        maxAngularAcceleration: 720.0,
      },
      goalEndState: { velocity: 0.0, rotation: 180.0 },
      idealStartingState: { velocity: 0.0, rotation: 0.0 },
      reversed: false,
    })

    const path = parsePath(samplePathJson)
    assert.ok(path !== null)
    assert.strictEqual(path.waypoints.length, 2)

    const sampled = samplePath(path)
    assert.ok(sampled.length > 10)
    assert.ok(Math.abs(sampled[0].pos.x - 1.0) < 0.01)
    assert.ok(Math.abs(sampled[sampled.length - 1].pos.x - 4.0) < 0.01)

    const rotMid = getRotationAtWaypointRelativePos(path, 0.5)
    assert.ok(Math.abs(rotMid - 90.0) < 1.0)
  })

  it('parses PathPlanner auto JSON and extracts referenced path names', () => {
    const sampleAutoJson = JSON.stringify({
      version: '2025.0',
      command: {
        type: 'sequential',
        data: {
          commands: [
            { type: 'named', data: { name: 'Intake' } },
            { type: 'path', data: { pathName: 'PathAlpha' } },
            {
              type: 'parallel',
              data: {
                commands: [
                  { type: 'wait', data: { waitTime: 2.0 } },
                  { type: 'path', data: { pathName: 'PathBeta' } },
                ],
              },
            },
          ],
        },
      },
      resetOdom: true,
      folder: 'Test',
      choreoAuto: false,
    })

    const auto = parseAuto(sampleAutoJson)
    assert.ok(auto !== null)
    assert.strictEqual(auto.resetOdom, true)

    const pathNames = extractPathNamesFromCommand(auto.command)
    assert.deepStrictEqual(pathNames, ['PathAlpha', 'PathBeta'])
  })
})
