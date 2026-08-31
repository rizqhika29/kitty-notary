"""Shared pytest configuration for genlayer-ai-notary.

Wraps gltest's direct-test harness to work around two Windows/platform
issues in the installed ``genlayer-test`` package:

1. The PyPI ``genlayer`` placeholder package shadows the real SDK in
   ``sys.modules`` because the direct VM imports ``genlayer`` (via
   ``create_address``) before the SDK path is added to ``sys.path``.
   We purge the placeholder modules right before each deploy so the
   real SDK is loaded.

2. gltest's ``_inject_message_to_fd0`` unlinks the temp stdin file while
   it is still open on Windows (the file is dup'd onto fd 0). We defer
   the unlink into the VM teardown, after the original stdin is restored.
"""
import sys

import pytest

import gltest.direct.vm as _vm_module
import gltest.direct.loader as _loader_module


def _purge_genlayer_from_sys_modules() -> None:
    for mod_name in [
        m for m in list(sys.modules)
        if m == "genlayer" or m.startswith("genlayer.")
    ]:
        del sys.modules[mod_name]


_ORIG_INJECT = _loader_module._inject_message_to_fd0
_ORIG_CLEANUP = _vm_module.VMContext._cleanup_after_deactivate


def _patched_inject_message_to_fd0(vm) -> None:
    """Windows-safe stdin injection: defer temp-file unlink to teardown."""
    import os
    import tempfile

    try:
        from genlayer.py import calldata
        from genlayer.py.types import Address
    except ImportError:
        return

    sender_addr = vm.sender
    if isinstance(sender_addr, bytes):
        sender_addr = Address(sender_addr)

    contract_addr = vm._contract_address
    if isinstance(contract_addr, bytes):
        contract_addr = Address(contract_addr)

    origin_addr = vm.origin
    if isinstance(origin_addr, bytes):
        origin_addr = Address(origin_addr)

    message_data = {
        "contract_address": contract_addr,
        "sender_address": sender_addr,
        "origin_address": origin_addr,
        "stack": [],
        "value": vm._value,
        "datetime": vm._datetime,
        "is_init": False,
        "chain_id": vm._chain_id,
        "entry_kind": 0,
        "entry_data": b"",
        "entry_stage_data": None,
    }

    encoded = calldata.encode(message_data)

    fd, path = tempfile.mkstemp()
    try:
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)

        original_stdin = os.dup(0)
        vm._original_stdin_fd = original_stdin
        os.dup2(fd, 0)
    finally:
        os.close(fd)
        vm._stdin_temp_path = path


def _patched_cleanup_after_deactivate(self):
    try:
        path = getattr(self, "_stdin_temp_path", None)
        _ORIG_CLEANUP(self)
        if path is not None:
            import os
            try:
                os.unlink(path)
            except OSError:
                pass
            self._stdin_temp_path = None
    except BaseException:
        raise


_loader_module._inject_message_to_fd0 = _patched_inject_message_to_fd0
_vm_module.VMContext._cleanup_after_deactivate = _patched_cleanup_after_deactivate


@pytest.fixture
def direct_deploy(direct_vm):
    """gltest deploy fixture + purge of the placeholder genlayer module."""
    from gltest.direct.loader import deploy_contract as _deploy_contract

    def _deploy(contract_path, *args, sdk_version=None, **kwargs):
        _purge_genlayer_from_sys_modules()
        return _deploy_contract(
            contract_path, direct_vm, *args, sdk_version=sdk_version, **kwargs
        )

    return _deploy