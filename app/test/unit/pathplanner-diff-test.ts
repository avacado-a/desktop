import { expect } from 'chai'
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
import { IPathPlannerPath, IPathPlannerAuto } from '../../src/models/pathplanner'

describe('PathPlanner Diff Engine', () => {
  it('correctly evaluates a cubic bezier curve', () => {
    const p0 = { x: 0, y: 0 }
    const p1 = { x: 0, y: 1 }
    const p2 = { x: 1, y: 1 }
    const p3 = { x: 1, y: 0 }

    const midpoint = evaluateCubicBezier(p0, p1, p2, p3, 0.5)
    expect(midpoint.x).to.be.closeTo(0.5, 0.001)
    expect(midpoint.y).to.be.closeTo(0.75, 0.001)
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
    expect(path).to.not.be.null
    expect(path!.waypoints).to.have.lengthOf(2)

    const sampled = samplePath(path!)
    expect(sampled.length).to.be.greaterThan(10)
    expect(sampled[0].pos.x).to.be.closeTo(1.0, 0.01)
    expect(sampled[sampled.length - 1].pos.x).to.be.closeTo(4.0, 0.01)

    const rotMid = getRotationAtWaypointRelativePos(path!, 0.5)
    expect(rotMid).to.be.closeTo(90.0, 1.0)
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
    expect(auto).to.not.be.null
    expect(auto!.resetOdom).to.be.true

    const pathNames = extractPathNamesFromCommand(auto!.command)
    expect(pathNames).to.deep.equal(['PathAlpha', 'PathBeta'])
  })
})
