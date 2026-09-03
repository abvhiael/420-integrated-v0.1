// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

library MediaIds420 {
    bytes32 internal constant CAP_TRANSCODE_H264 = keccak256("420/MEDIA/CAP/TRANSCODE/H264/V1");
    bytes32 internal constant CAP_TRANSCODE_H265 = keccak256("420/MEDIA/CAP/TRANSCODE/H265/V1");
    bytes32 internal constant CAP_TRANSCODE_AV1 = keccak256("420/MEDIA/CAP/TRANSCODE/AV1/V1");
    bytes32 internal constant CAP_TRANSCODE_VP9 = keccak256("420/MEDIA/CAP/TRANSCODE/VP9/V1");
    bytes32 internal constant CAP_LIVE_RELAY = keccak256("420/MEDIA/CAP/LIVE_RELAY/V1");
    bytes32 internal constant CAP_WEBRTC = keccak256("420/MEDIA/CAP/WEBRTC/V1");
    bytes32 internal constant CAP_RECORDING = keccak256("420/MEDIA/CAP/RECORDING/V1");
    bytes32 internal constant CAP_TRANSCRIPTION = keccak256("420/MEDIA/CAP/TRANSCRIPTION/V1");
    bytes32 internal constant CAP_VIDEO_INFERENCE = keccak256("420/MEDIA/CAP/VIDEO_INFERENCE/V1");

    bytes32 internal constant KIND_LIVE = keccak256("420/MEDIA/JOB/LIVE/V1");
    bytes32 internal constant KIND_TRANSCODE = keccak256("420/MEDIA/JOB/TRANSCODE/V1");
    bytes32 internal constant KIND_RECORDING = keccak256("420/MEDIA/JOB/RECORDING/V1");
    bytes32 internal constant KIND_INFERENCE = keccak256("420/MEDIA/JOB/INFERENCE/V1");

    bytes32 internal constant SLA_PASS = keccak256("420/MEDIA/SLA/PASS/V1");
    bytes32 internal constant SLA_FAIL = keccak256("420/MEDIA/SLA/FAIL/V1");
}
